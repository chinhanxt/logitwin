import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Repository } from "./database.ts";
import { DecisionService, forecast, requireRole } from "../modules/logistics/decisions.ts";
import { DomainError } from "./contracts.ts";
import type { Actor, Role } from "./contracts.ts";
import { identity, startLogin, finishLogin } from "./identity.ts";
import { RagService } from "./rag.ts";
import { ColdChainService } from "../modules/logistics/coldchain.ts";
import { planRoutes } from "../modules/logistics/routing.ts";
import { WorkflowService } from "./workflow.ts";
import { EventStream } from "./event-stream.ts";
import { operationSummary } from "./operations.ts";
import { explain, search } from "./intelligence.ts";
const dataDir = resolve("var");
mkdirSync(dataDir, { recursive: true });
const repo = new Repository(process.env.DXOS_DB || resolve(dataDir, "core.sqlite"));
repo.seed();
const service = new DecisionService(repo);
const rag = new RagService(repo);
const coldchain = new ColdChainService(repo);
function cancellation(res: ServerResponse) {
  const c = new AbortController();
  res.once("close", () => {
    if (!res.writableEnded) c.abort();
  });
  return c.signal;
}
const eventStream = new EventStream();
const workflow = new WorkflowService(repo);
const sessions = new Map<string, { actor: Actor; expires: number }>();
const authMode = identity ? "oidc" : "local-demo";
const allowedOrigins = new Set(["http://127.0.0.1:5190", "http://localhost:5190"]);
function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(data));
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let value = "";
  for await (const chunk of req) {
    value += chunk;
    if (Buffer.byteLength(value) > 32768) throw new DomainError(413, "Nội dung quá lớn.");
  }
  try {
    const parsed = JSON.parse(value || "{}");
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw Error();
    return parsed;
  } catch {
    throw new DomainError(400, "JSON không hợp lệ.");
  }
}
function actorFor(req: IncomingMessage) {
  const cookie = req.headers.cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("dxos_session="))
    ?.slice(13);
  for (const [token, entry] of sessions) if (entry.expires < Date.now()) sessions.delete(token);
  const s = cookie ? sessions.get(cookie) : undefined;
  if (!s || s.expires < Date.now()) throw new DomainError(401, "Phiên đã hết hạn. Vui lòng đăng nhập lại.");
  return s.actor;
}
const server = createServer(async (req, res) => {
  const started = Date.now();
  const requestId = randomUUID();
  res.setHeader("X-Request-Id", requestId);
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const path = url.pathname;
    if (req.method !== "GET" && req.headers.origin && !allowedOrigins.has(req.headers.origin)) throw new DomainError(403, "Origin không được phép.");
    if (req.method !== "GET" && req.headers["content-type"]?.split(";")[0] !== "application/json")
      throw new DomainError(415, "Yêu cầu application/json.");
    if (path === "/api/health" && req.method === "GET")
      return send(res, 200, {
        status: "ok",
        mode: authMode,
        database: "sqlite",
        workflow: "bpmn-engine-26.0.5",
        updates: "sse-persistent-event-replay",
        identity: identity ? "keycloak-oidc" : "demo-session",
        llm: "local-adapter-configured-unchecked",
      });
    if (path === "/api/auth/config" && req.method === "GET") return send(res, 200, { mode: authMode });
    if (path === "/api/auth/login" && req.method === "GET") {
      const login = startLogin();
      res.setHeader("Set-Cookie", `dxos_oidc=${login.state}; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=300`);
      res.writeHead(302, { Location: login.url });
      return res.end();
    }
    if (path === "/api/auth/callback" && req.method === "GET") {
      const stateCookie =
        req.headers.cookie
          ?.split(";")
          .map((v) => v.trim())
          .find((v) => v.startsWith("dxos_oidc="))
          ?.slice(10) || "";
      const verified = await finishLogin(url.searchParams.get("code") || "", url.searchParams.get("state") || "", stateCookie);
      for (const [token, entry] of sessions) if (entry.expires < Date.now()) sessions.delete(token);
      const token = randomBytes(32).toString("hex");
      sessions.set(token, verified);
      res.setHeader("Set-Cookie", [
        `dxos_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${Math.max(0, Math.floor((verified.expires - Date.now()) / 1000))}`,
        "dxos_oidc=; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=0",
      ]);
      res.writeHead(302, { Location: "/" });
      return res.end();
    }
    if (path === "/api/auth/logout" && req.method === "POST") {
      const token = req.headers.cookie
        ?.split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith("dxos_session="))
        ?.slice(13);
      if (token) sessions.delete(token);
      res.setHeader("Set-Cookie", "dxos_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0");
      return send(res, 200, { logout: true });
    }
    if (path === "/api/session" && req.method === "POST") {
      if (identity) throw new DomainError(403, "Chọn vai trò demo đã tắt; vui lòng đăng nhập SSO.");
      const b = await body(req);
      if (!["planner", "approver", "viewer"].includes(String(b.role))) throw new DomainError(422, "Vai trò không hợp lệ.");
      const role = b.role as Role,
        token = randomBytes(32).toString("hex");
      for (const [key, s] of sessions) if (s.expires < Date.now()) sessions.delete(key);
      sessions.set(token, { actor: { id: `demo-${role}`, tenant: "demo-chain", role }, expires: Date.now() + 8 * 3600000 });
      res.setHeader("Set-Cookie", `dxos_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800`);
      return send(res, 200, { id: `demo-${role}`, tenant: "demo-chain", role, mode: "local-demo" });
    }
    const actor = actorFor(req);
    if (path === "/api/events/stream" && req.method === "GET")
      return eventStream.open(repo, actor, req, res, () => {
        try {
          return actorFor(req).id === actor.id;
        } catch {
          return false;
        }
      });
    if (path === "/api/operations" && req.method === "GET") return send(res, 200, operationSummary(repo, actor.tenant));
    if (path === "/api/session" && req.method === "GET") return send(res, 200, { ...actor, mode: authMode });
    if (path === "/api/overview" && req.method === "GET") {
      const stocks = repo.stocks(actor.tenant),
        decisions = repo.decisions(actor.tenant);
      const movements = repo.movements(actor.tenant);
      return send(res, 200, {
        stocks,
        forecasts: stocks.map(forecast),
        decisions,
        movements,
        workflows: workflow.list(actor.tenant),
        events: repo.events(actor.tenant),
        telemetry: repo.db.prepare("SELECT * FROM telemetry WHERE tenant=? ORDER BY id DESC LIMIT 30").all(actor.tenant),
        dataSource: "Dữ liệu mẫu · 3 cửa hàng · 7 ngày",
        now: new Date().toISOString(),
      });
    }
    if (path === "/api/analysis" && req.method === "POST") {
      const result = service.generate(actor);
      await workflow.attachPending(actor);
      return send(res, 200, result);
    }
    const decision = path.match(/^\/api\/decisions\/([a-f0-9-]{36})\/(approve|reject|execute|explain)$/);
    if (decision) {
      const [, id, action] = decision;
      if (action === "explain" && req.method === "GET") return send(res, 200, explain(service.get(actor, id)));
      if (req.method === "POST" && action !== "explain")
        return send(res, 200, await workflow.decision(actor, id, action as "approve" | "reject" | "execute"));
    }
    const movement = path.match(/^\/api\/movements\/([a-f0-9-]{36})\/(dispatch|receive|cancel)$/);
    if (movement && req.method === "POST") {
      const payload = await body(req);
      const action = movement[2] as "dispatch" | "receive" | "cancel";
      const input = action === "cancel" ? payload.reason : action === "receive" && Object.keys(payload).length ? payload : undefined;
      return send(res, 200, await workflow.movement(actor, movement[1], action, input));
    }
    if (path === "/api/workflows" && req.method === "GET") return send(res, 200, { workflows: workflow.list(actor.tenant) });
    if (path === "/api/documents" && req.method === "GET")
      return send(res, 200, { documents: search(repo, actor, (url.searchParams.get("q") || "").slice(0, 200)), mode: "keyword" });
    if (path === "/api/documents" && req.method === "POST") {
      requireRole(actor, ["planner"]);
      const b = await body(req);
      if (
        typeof b.title !== "string" ||
        typeof b.body !== "string" ||
        b.title.trim().length < 3 ||
        b.title.length > 120 ||
        b.body.trim().length < 20 ||
        b.body.length > 20000
      )
        throw new DomainError(422, "Tiêu đề 3–120 ký tự; nội dung 20–20.000 ký tự.");
      const id = randomUUID();
      repo.transaction(() => {
        repo.db
          .prepare("INSERT INTO documents VALUES(?,?,?,?,?,?,?)")
          .run(id, actor.tenant, b.title!.toString().trim(), b.body!.toString().trim(), "internal", 1, new Date().toISOString());
        repo.event(actor, "document.created", id, { title: b.title, classification: "internal" });
      });
      return send(res, 201, { id });
    }
    if (path === "/api/telemetry" && req.method === "POST") {
      const b = await body(req);
      if (typeof b.store !== "string" || typeof b.temperature !== "number") throw new DomainError(422, "Cần cửa hàng và nhiệt độ.");
      return send(res, 200, coldchain.ingest(actor, b.store, b.temperature));
    }
    if (path === "/api/telemetry/release" && req.method === "POST") {
      const b = await body(req);
      if (typeof b.store !== "string" || typeof b.reason !== "string") throw new DomainError(422, "Cần cửa hàng và lý do kiểm tra.");
      return send(res, 200, coldchain.release(actor, b.store, b.reason));
    }
    if (path === "/api/knowledge/index" && req.method === "POST") return send(res, 200, await rag.index(actor, cancellation(res)));
    if (path === "/api/agent/ask" && req.method === "POST") {
      const b = await body(req);
      if (typeof b.question !== "string" || b.question.trim().length < 5 || b.question.length > 500)
        throw new DomainError(422, "Câu hỏi cần 5–500 ký tự.");
      return send(res, 200, await rag.ask(actor, b.question.trim(), cancellation(res)));
    }
    if (path === "/api/routes/preview" && req.method === "POST") {
      const b = await body(req);
      return send(
        res,
        200,
        planRoutes(repo, actor, { capacityKg: Number(b.capacityKg), maxMinutes: Number(b.maxMinutes), speedKph: Number(b.speedKph) }),
      );
    }
    if (path === "/api/events" && req.method === "GET") return send(res, 200, { events: repo.events(actor.tenant) });
    throw new DomainError(404, "API không tồn tại.");
  } catch (error) {
    const known = error instanceof DomainError;
    send(res, known ? error.status : 500, { error: known ? error.message : "Lỗi nội bộ.", requestId });
    if (!known) console.error(error);
  } finally {
    console.log(
      JSON.stringify({
        level: "debug",
        requestId,
        method: req.method,
        path: req.url?.split("?")[0],
        status: res.statusCode,
        ms: Date.now() - started,
      }),
    );
  }
});
server.listen(5191, "127.0.0.1", () => console.log("DX-OS headless demo core: http://127.0.0.1:5191"));
process.on("SIGTERM", () => {
  eventStream.closeAll();
  server.close(() => {
    repo.close();
    process.exit(0);
  });
});
