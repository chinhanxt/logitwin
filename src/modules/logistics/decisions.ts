import { randomUUID } from "node:crypto";
import { MovementService } from "./movements.ts";
import { Repository } from "../../core/database.ts";
import { DomainError } from "../../core/contracts.ts";
import type { Actor, Decision, DecisionPayload, Forecast, Stock } from "../../core/contracts.ts";
export function forecast(s: Stock): Forecast {
  const values = s.history;
  const total = values.reduce((n, v) => n + v, 0);
  const daily = Math.ceil(total / values.length);
  return {
    stockId: s.id,
    daily,
    low: Math.min(...values),
    high: Math.max(...values),
    available: s.quality === "hold" ? 0 : s.on_hand - s.reserved,
    cover: s.quality === "hold" ? 0 : Math.round(((s.on_hand - s.reserved) / daily) * 10) / 10,
    method: "Trung bình 7 ngày · baseline",
    sampleDays: values.length,
  };
}
export function requireRole(actor: Actor, roles: string[]) {
  if (!roles.includes(actor.role)) throw new DomainError(403, "Vai trò hiện tại không được thực hiện thao tác này.");
}
const alive = (s: Stock) => s.quality !== "hold" && s.expires > new Date().toISOString().slice(0, 10);
export class DecisionService {
  repo: Repository;
  constructor(repo: Repository) {
    this.repo = repo;
  }
  generate(actor: Actor) {
    requireRole(actor, ["planner"]);
    return this.repo.transaction(() => {
      const active = this.repo.decisions(actor.tenant).filter((d) => d.status === "pending" || d.status === "approved");
      if (active.length) return { created: 0, existing: active.length };
      const stocks = this.repo.stocks(actor.tenant);
      let count = 0;
      const planned = new Map<string, number>();
      const touched = new Set<string>();
      for (const stock of stocks) {
        if (!alive(stock) || touched.has(stock.id)) continue;
        const inbound = this.repo.db
          .prepare("SELECT 1 FROM movements WHERE tenant=? AND target=? AND kind='transfer' AND status IN ('reserved','in_transit')")
          .get(actor.tenant, stock.id);
        if (inbound) continue;
        const outstanding = this.repo.db
          .prepare("SELECT 1 FROM movements WHERE tenant=? AND source=? AND kind='restock' AND status='ordered'")
          .get(actor.tenant, stock.id);
        if (outstanding) continue;
        const f = forecast(stock);
        const need = Math.max(0, f.daily * 2 - f.available);
        if (need) {
          const source = stocks
            .filter(
              (s) => s.store !== stock.store && s.product === stock.product && s.unit === stock.unit && alive(s) && !touched.has(s.id),
            )
            .find((s) => s.on_hand - s.reserved - (planned.get(s.id) || 0) - forecast(s).daily * 2 >= need);
          if (source) {
            touched.add(source.id);
            const sf = forecast(source);
            planned.set(source.id, (planned.get(source.id) || 0) + need);
            this.create(actor, "transfer", {
              source: source.id,
              target: stock.id,
              quantity: need,
              sourceVersion: source.version,
              targetVersion: stock.version,
              forecast: f,
              reason: `${stock.store.toUpperCase()} có ${f.available} ${stock.unit}, cần ${f.daily * 2} cho 2 ngày; ${source.store.toUpperCase()} có ${sf.available} khả dụng.`,
              assumptions: [
                "Nhu cầu ổn định theo 7 ngày mẫu.",
                "Kiểm tra chất lượng và chuỗi lạnh trước khi giao.",
                "Điều chuyển nội thành trong ngày.",
              ],
            });
          } else
            this.create(actor, "restock", {
              source: stock.id,
              quantity: need,
              sourceVersion: stock.version,
              forecast: f,
              reason: `Tồn khả dụng ${f.available} thấp hơn mức phủ 2 ngày (${f.daily * 2} ${stock.unit}).`,
              assumptions: ["Nhà cung cấp giao trong 1 ngày.", "Đơn mua chưa phải tồn kho nhận thực tế."],
            });
          touched.add(stock.id);
          count++;
        } else if (
          !this.repo
            .decisions(actor.tenant)
            .some((d) => d.kind === "markdown" && d.status === "executed" && d.payload.source === stock.id) &&
          stock.expires <= new Date(Date.now() + 86400000).toISOString().slice(0, 10) &&
          f.available > f.daily
        ) {
          this.create(actor, "markdown", {
            source: stock.id,
            quantity: f.available,
            sourceVersion: stock.version,
            unitPrice: Math.round(stock.price * 0.8),
            forecast: f,
            reason: `Còn ${f.available} ${stock.unit}, hạn dùng ${stock.expires}; nhu cầu mẫu ${f.daily}/ngày.`,
            assumptions: ["Giảm giá 20% là quy tắc thử nghiệm, chưa tối ưu lợi nhuận.", "Chỉ bán hàng đạt kiểm tra chất lượng."],
          });
          touched.add(stock.id);
          count++;
        }
      }
      this.repo.event(actor, "analysis.completed", "analysis", {
        created: count,
        source: "seed-v1",
        method: "mean-7d",
      });
      return { created: count, existing: 0 };
    });
  }
  create(actor: Actor, kind: Decision["kind"], payload: DecisionPayload) {
    const id = randomUUID(),
      time = new Date().toISOString();
    this.repo.db
      .prepare("INSERT INTO decisions VALUES(?,?,?,?,?,?,?,?,?)")
      .run(id, actor.tenant, kind, "pending", JSON.stringify(payload), actor.id, null, time, time);
    this.repo.event(actor, "decision.proposed", id, { kind, payload });
    return id;
  }
  get(actor: Actor, id: string) {
    const d = this.repo.decisions(actor.tenant).find((d) => d.id === id);
    if (!d) throw new DomainError(404, "Không tìm thấy đề xuất.");
    return d;
  }
  transition(actor: Actor, id: string, action: "approve" | "reject" | "execute") {
    requireRole(actor, action === "execute" ? ["approver"] : ["approver"]);
    return this.repo.transaction(() => {
      const d = this.get(actor, id);
      if (
        (action === "approve" && d.status === "approved") ||
        (action === "execute" && d.status === "executed") ||
        (action === "reject" && d.status === "rejected")
      )
        return d;
      if (action !== "execute" && d.created_by === actor.id) throw new DomainError(403, "Người tạo không được tự duyệt đề xuất.");
      if (
        (action === "execute" && d.status !== "approved") ||
        (action === "approve" && d.status !== "pending") ||
        (action === "reject" && !["pending", "approved"].includes(d.status))
      )
        throw new DomainError(409, "Trạng thái workflow không cho phép thao tác.");
      if (action !== "reject") this.validate(actor, d);
      if (action === "execute") this.execute(actor, d);
      const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "executed";
      this.repo.db
        .prepare("UPDATE decisions SET status=?,approved_by=COALESCE(approved_by,?),updated_at=? WHERE tenant=? AND id=?")
        .run(status, action === "approve" ? actor.id : null, new Date().toISOString(), actor.tenant, id);
      this.repo.event(actor, `decision.${status}`, id, {
        kind: d.kind,
        quantity: d.payload.quantity,
      });
      return this.get(actor, id);
    });
  }
  validate(actor: Actor, d: Decision) {
    const p = d.payload,
      stocks = this.repo.stocks(actor.tenant);
    const source = stocks.find((s) => s.id === p.source);
    if (!source || source.version !== p.sourceVersion)
      throw new DomainError(409, "Dữ liệu nguồn đã thay đổi. Hãy từ chối đề xuất cũ và phân tích lại.");
    if (!alive(source)) throw new DomainError(409, "Hàng bị cách ly, đã hết hạn hoặc đến ngày hết hạn; cần kiểm tra thủ công.");
    if (!Number.isSafeInteger(p.quantity) || p.quantity <= 0) throw new DomainError(422, "Số lượng không hợp lệ.");
    if (d.kind === "transfer") {
      const target = stocks.find((s) => s.id === p.target);
      if (
        !target ||
        target.quality === "hold" ||
        target.version !== p.targetVersion ||
        target.store === source.store ||
        target.product !== source.product ||
        target.unit !== source.unit
      )
        throw new DomainError(409, "Dữ liệu đích đã thay đổi. Hãy phân tích lại.");
      if (source.on_hand - source.reserved < p.quantity) throw new DomainError(409, "Không đủ tồn khả dụng.");
    }
  }
  execute(actor: Actor, d: Decision) {
    const p = d.payload;
    if (d.kind === "markdown")
      this.repo.db.prepare("UPDATE stock SET price=?,version=version+1 WHERE tenant=? AND id=?").run(p.unitPrice!, actor.tenant, p.source);
    else new MovementService(this.repo).createFromDecision(actor, d);
  }
  receive(actor: Actor, id: string, input?: unknown) {
    return new MovementService(this.repo).receive(actor, id, input);
  }
}
