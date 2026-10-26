import type { IncomingMessage, ServerResponse } from "node:http";
import type { Actor, Event } from "./contracts.ts";
import { DomainError } from "./contracts.ts";
import { Repository } from "./database.ts";
export function parseCursor(value: string | undefined) {
  if (value === undefined || value === "") return 0;
  if (!/^\d{1,15}$/.test(value) || !Number.isSafeInteger(Number(value))) throw new DomainError(422, "Event cursor không hợp lệ.");
  return Number(value);
}
export function eventsAfter(repo: Repository, tenant: string, cursor: number): Event[] {
  return repo.db.prepare("SELECT * FROM events WHERE tenant=? AND seq>? ORDER BY seq ASC LIMIT 50").all(tenant, cursor) as unknown as Event[];
}
export class EventStream {
  responses = new Set<ServerResponse>();
  closeAll() {
    for (const response of this.responses) response.end();
  }
  connections = new Map<string, number>();
  open(repo: Repository, actor: Actor, req: IncomingMessage, res: ServerResponse, isValid: () => boolean) {
    const key = `${actor.tenant}:${actor.id}`;
    const count = this.connections.get(key) || 0;
    if (count >= 4) throw new DomainError(429, "Tối đa bốn luồng realtime mỗi tài khoản.");
    const header = req.headers["last-event-id"];
    if (Array.isArray(header)) throw new DomainError(422, "Event cursor không hợp lệ.");
    let cursor = parseCursor(header),
      blocked = false,
      closed = false;
    this.connections.set(key, count + 1);
    this.responses.add(res);
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    });
    res.flushHeaders();
    res.write("retry: 2000\n\n");
    const write = (event: string, data: unknown, id?: number) => {
      if (closed) return;
      blocked = !res.write(`${id !== undefined ? `id: ${id}\n` : ""}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const pump = () => {
      if (closed) return;
      if (!isValid()) {
        write("session-expired", { reason: "Phiên đã hết hạn hoặc đã đăng xuất." });
        res.end();
        return;
      }
      if (blocked) return;
      try {
        for (const event of eventsAfter(repo, actor.tenant, cursor)) {
          cursor = event.seq;
          write("change", { seq: event.seq, type: event.type, entity: event.entity, createdAt: event.created_at }, event.seq);
          if (blocked) break;
        }
      } catch {
        res.end();
      }
    };
    res.on("drain", () => {
      blocked = false;
      pump();
    });
    const poll = setInterval(pump, 500),
      heartbeat = setInterval(() => {
        if (!closed && !blocked) res.write(": heartbeat\n\n");
      }, 15000);
    res.once("close", () => {
      closed = true;
      this.responses.delete(res);
      clearInterval(poll);
      clearInterval(heartbeat);
      const n = (this.connections.get(key) || 1) - 1;
      if (n) this.connections.set(key, n);
      else this.connections.delete(key);
    });
    pump();
  }
}
