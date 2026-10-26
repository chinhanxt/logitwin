import { randomUUID } from "node:crypto";
import { DomainError } from "../../core/contracts.ts";
import type { Actor, Decision, Movement, PurchaseReceipt, Stock } from "../../core/contracts.ts";
import type { Repository } from "../../core/database.ts";
import { addLot, assertAllocations, assertLotBalance, refreshExpiry, removeReservedLots, reserveLots, today, validExpiry } from "./lots.ts";

/** Local demonstration policy, not a substitute for truck/locker sensor evidence. */
export const coldPolicy = {
  minimum: 200,
  maximum: 800,
  maxAgeMs: 300000,
  source: "manual-demo",
} as const;
export class MovementService {
  repo: Repository;
  constructor(repo: Repository) {
    this.repo = repo;
  }
  get(actor: Actor, id: string): Movement {
    const movement = this.repo.movements(actor.tenant).find((m) => m.id === id);
    if (!movement) throw new DomainError(404, "Không tìm thấy lệnh.");
    return movement;
  }
  private authorize(actor: Actor) {
    if (actor.role !== "approver") throw new DomainError(403, "Vai trò hiện tại không được thực hiện thao tác này.");
  }
  private quantity(movement: Movement) {
    if (!Number.isSafeInteger(movement.quantity) || movement.quantity <= 0)
      throw new DomainError(409, "Số lượng lệnh không hợp lệ; cần đối soát.");
  }
  private stock(actor: Actor, id: string) {
    const stock = this.repo.stocks(actor.tenant).find((s) => s.id === id);
    if (!stock) throw new DomainError(409, "Thiếu tồn kho thuộc chuỗi hiện tại.");
    return stock;
  }
  private cold(actor: Actor, stock: Stock) {
    if (stock.quality === "hold") throw new DomainError(409, `Cửa hàng ${stock.store} đang cách ly; cần kiểm tra chất lượng.`);
    const reading = this.repo.db
      .prepare("SELECT id,temperature,created_at,source FROM telemetry WHERE tenant=? AND store=? ORDER BY id DESC LIMIT 1")
      .get(actor.tenant, stock.store);
    const temperature = Number(reading?.temperature);
    const age = reading ? Date.now() - Date.parse(String(reading.created_at)) : NaN;
    if (
      !reading ||
      !Number.isFinite(temperature) ||
      !Number.isFinite(age) ||
      age < -5000 ||
      age > coldPolicy.maxAgeMs ||
      temperature < coldPolicy.minimum ||
      temperature > coldPolicy.maximum
    )
      throw new DomainError(409, `Cần nhiệt độ 2–8°C của ${stock.store} trong 5 phút gần nhất (bản mẫu nhập tay).`);
    return { store: stock.store, reading: reading.id, source: reading.source };
  }
  private transferStocks(actor: Actor, movement: Movement) {
    const source = this.stock(actor, movement.source),
      target = this.stock(actor, movement.target || "");
    if (source.id === target.id || source.store === target.store || source.product !== target.product || source.unit !== target.unit)
      throw new DomainError(409, "Điều chuyển cần hai cửa hàng khác nhau, cùng sản phẩm và đơn vị.");
    return { source, target };
  }
  /** Called inside the decision execution transaction. */
  createFromDecision(actor: Actor, decision: Decision) {
    const p = decision.payload,
      id = randomUUID();
    this.repo.db
      .prepare("INSERT INTO movements(id,tenant,decision,kind,source,target,quantity,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .run(
        id,
        actor.tenant,
        decision.id,
        decision.kind,
        p.source,
        p.target ?? null,
        p.quantity,
        decision.kind === "transfer" ? "reserved" : "ordered",
        new Date().toISOString(),
      );
    if (decision.kind === "transfer") {
      reserveLots(this.repo, actor.tenant, id, p.source, p.quantity);
      this.repo.db
        .prepare("UPDATE stock SET reserved=reserved+?,version=version+1 WHERE tenant=? AND id=?")
        .run(p.quantity, actor.tenant, p.source);
      assertLotBalance(this.repo, actor.tenant, p.source);
    }
    this.repo.event(actor, decision.kind === "transfer" ? "transfer.reserved" : "purchase.ordered", id, {
      decision: decision.id,
      quantity: p.quantity,
      source: p.source,
      target: p.target ?? null,
    });
    return this.get(actor, id);
  }
  dispatch(actor: Actor, id: string) {
    this.authorize(actor);
    return this.repo.transaction(() => {
      const m = this.get(actor, id);
      if (m.status === "in_transit" || (m.status === "received" && m.dispatched_at)) return m;
      if (m.kind !== "transfer" || m.status !== "reserved") throw new DomainError(409, "Chỉ lệnh điều chuyển đã giữ hàng được xuất phát.");
      this.quantity(m);
      const { source, target } = this.transferStocks(actor, m);
      const readings = [this.cold(actor, source), this.cold(actor, target)];
      assertLotBalance(this.repo, actor.tenant, source.id);
      const lots = assertAllocations(this.repo, actor.tenant, id, m.quantity, source.id, true);
      removeReservedLots(this.repo, actor.tenant, lots, true);
      this.repo.db
        .prepare("UPDATE stock SET on_hand=on_hand-?,reserved=reserved-?,version=version+1 WHERE tenant=? AND id=?")
        .run(m.quantity, m.quantity, actor.tenant, source.id);
      refreshExpiry(this.repo, actor.tenant, source.id);
      assertLotBalance(this.repo, actor.tenant, source.id);
      this.repo.db
        .prepare("UPDATE movements SET status='in_transit',dispatched_at=? WHERE tenant=? AND id=?")
        .run(new Date().toISOString(), actor.tenant, id);
      this.repo.event(actor, "transfer.dispatched", id, {
        quantity: m.quantity,
        source: m.source,
        target: m.target,
        lots,
        readings,
        inTransitQuantity: m.quantity,
      });
      return this.get(actor, id);
    });
  }
  cancel(actor: Actor, id: string, reason: unknown) {
    this.authorize(actor);
    if (typeof reason !== "string" || reason.trim().length < 10 || reason.trim().length > 500)
      throw new DomainError(422, "Lý do hủy cần 10–500 ký tự.");
    const canonicalReason = reason.trim();
    return this.repo.transaction(() => {
      const m = this.get(actor, id);
      if (m.status === "cancelled") {
        if (m.cancel_reason !== canonicalReason) throw new DomainError(409, "Lệnh đã hủy với lý do khác.");
        return m;
      }
      if (!["reserved", "ordered"].includes(m.status))
        throw new DomainError(409, "Không thể hủy lệnh đã xuất phát hoặc đã nhận. Hàng đang đi cần quy trình hoàn trả riêng.");
      this.quantity(m);
      if (m.kind === "transfer" && m.status === "reserved") {
        const source = this.stock(actor, m.source);
        assertLotBalance(this.repo, actor.tenant, source.id);
        const lots = assertAllocations(this.repo, actor.tenant, id, m.quantity, source.id, true, false);
        removeReservedLots(this.repo, actor.tenant, lots, false);
        this.repo.db
          .prepare("UPDATE stock SET reserved=reserved-?,version=version+1 WHERE tenant=? AND id=?")
          .run(m.quantity, actor.tenant, source.id);
        assertLotBalance(this.repo, actor.tenant, source.id);
      } else if (m.kind !== "restock" || m.status !== "ordered") throw new DomainError(409, "Loại lệnh và trạng thái không khớp.");
      this.repo.db
        .prepare("UPDATE movements SET status='cancelled',cancelled_at=?,cancel_reason=? WHERE tenant=? AND id=?")
        .run(new Date().toISOString(), canonicalReason, actor.tenant, id);
      this.repo.event(actor, `${m.kind === "transfer" ? "transfer" : "purchase"}.cancelled`, id, {
        quantity: m.quantity,
        reason: canonicalReason,
      });
      return this.get(actor, id);
    });
  }
  receive(actor: Actor, id: string, input?: unknown) {
    this.authorize(actor);
    return this.repo.transaction(() => {
      const m = this.get(actor, id);
      this.quantity(m);
      if (m.kind === "restock") return this.receivePurchase(actor, m, input);
      if (input !== undefined) throw new DomainError(422, "Điều chuyển giữ nguyên chứng từ lô nguồn; không nhận metadata lô mua mới.");
      if (m.status === "received") return m;
      if (!["reserved", "in_transit"].includes(m.status)) throw new DomainError(409, "Trạng thái lệnh không cho phép nhận hàng.");
      const { source, target } = this.transferStocks(actor, m);
      const readings = [this.cold(actor, source), this.cold(actor, target)];
      assertLotBalance(this.repo, actor.tenant, source.id);
      assertLotBalance(this.repo, actor.tenant, target.id);
      const lots = assertAllocations(this.repo, actor.tenant, id, m.quantity, source.id, m.status === "reserved");
      if (!Number.isSafeInteger(target.on_hand + m.quantity)) throw new DomainError(409, "Tồn nhận vượt giới hạn số nguyên an toàn.");
      // Compatibility only: old clients atomically remove reserved stock and receive.
      if (m.status === "reserved") {
        removeReservedLots(this.repo, actor.tenant, lots, true);
        this.repo.db
          .prepare("UPDATE stock SET on_hand=on_hand-?,reserved=reserved-?,version=version+1 WHERE tenant=? AND id=?")
          .run(m.quantity, m.quantity, actor.tenant, source.id);
        refreshExpiry(this.repo, actor.tenant, source.id);
      }
      for (const lot of lots) {
        const received = addLot(this.repo, actor.tenant, target.id, {
          batchId: lot.batch_id,
          expires: lot.expires,
          quantity: lot.quantity,
          originStock: lot.origin_stock,
          originBatch: lot.origin_batch,
          movement: id,
        });
        this.repo.db
          .prepare("UPDATE movement_lots SET target_lot=? WHERE tenant=? AND movement=? AND source_lot=?")
          .run(received, actor.tenant, id, lot.source_lot);
      }
      this.repo.db
        .prepare("UPDATE stock SET on_hand=on_hand+?,version=version+1 WHERE tenant=? AND id=?")
        .run(m.quantity, actor.tenant, target.id);
      refreshExpiry(this.repo, actor.tenant, target.id);
      assertLotBalance(this.repo, actor.tenant, source.id);
      assertLotBalance(this.repo, actor.tenant, target.id);
      this.repo.db
        .prepare("UPDATE movements SET status='received',received_at=? WHERE tenant=? AND id=?")
        .run(new Date().toISOString(), actor.tenant, id);
      this.repo.event(actor, "transfer.received", id, {
        quantity: m.quantity,
        source: m.source,
        target: m.target,
        lots,
        readings,
        compatibilityDirectReceipt: m.status === "reserved",
      });
      return this.get(actor, id);
    });
  }
  private purchaseReceipt(input: unknown, quantity: number): PurchaseReceipt {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new DomainError(422, "Cần batchId, expires và quantity của lô nhập thực tế.");
    const r = input as Record<string, unknown>;
    if (
      Object.keys(r).some((key) => !["batchId", "expires", "quantity"].includes(key)) ||
      typeof r.batchId !== "string" ||
      !/^[\p{L}\p{N}][\p{L}\p{N} ._/-]{0,99}$/u.test(r.batchId.trim()) ||
      !validExpiry(r.expires) ||
      !Number.isSafeInteger(r.quantity) ||
      r.quantity !== quantity
    )
      throw new DomainError(
        422,
        "Mã lô 1–100 ký tự, hạn dùng hợp lệ sau hôm nay, số lượng nguyên đúng bằng đơn mua; chưa hỗ trợ nhận từng phần.",
      );
    return {
      batchId: r.batchId.trim(),
      expires: r.expires,
      quantity: r.quantity as number,
    };
  }
  private receivePurchase(actor: Actor, m: Movement, input: unknown) {
    // Compare retry with the stored receipt before checking current date/telemetry.
    if (m.status === "received") {
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw new DomainError(409, "Đơn mua đã nhận; cần đúng chứng từ nhận trước đó.");
      const r = input as Record<string, unknown>;
      if (
        Object.keys(r).length !== 3 ||
        typeof r.batchId !== "string" ||
        !m.receipt ||
        r.batchId.trim() !== m.receipt.batchId ||
        r.expires !== m.receipt.expires ||
        r.quantity !== m.receipt.quantity
      )
        throw new DomainError(409, "Đơn mua đã nhận với chứng từ khác.");
      return m;
    }
    if (m.status !== "ordered" || m.target !== null) throw new DomainError(409, "Chỉ đơn mua đang chờ được nhận hàng.");
    const receipt = this.purchaseReceipt(input, m.quantity),
      target = this.stock(actor, m.source);
    const readings = [this.cold(actor, target)];
    assertLotBalance(this.repo, actor.tenant, target.id);
    if (!Number.isSafeInteger(target.on_hand + receipt.quantity)) throw new DomainError(409, "Tồn nhận vượt giới hạn số nguyên an toàn.");
    if (
      this.repo.db
        .prepare("SELECT 1 FROM stock_lots WHERE tenant=? AND stock=? AND batch_id=? LIMIT 1")
        .get(actor.tenant, target.id, receipt.batchId)
    )
      throw new DomainError(409, "Mã lô đã tồn tại tại cửa hàng; cần đối soát để tránh nhập trùng.");
    const lotId = addLot(this.repo, actor.tenant, target.id, {
      ...receipt,
      originStock: "supplier-unverified",
      originBatch: receipt.batchId,
      movement: m.id,
    });
    this.repo.db
      .prepare("UPDATE stock SET on_hand=on_hand+?,version=version+1 WHERE tenant=? AND id=?")
      .run(receipt.quantity, actor.tenant, target.id);
    refreshExpiry(this.repo, actor.tenant, target.id);
    assertLotBalance(this.repo, actor.tenant, target.id);
    this.repo.db
      .prepare("UPDATE movements SET status='received',received_at=?,receipt=? WHERE tenant=? AND id=?")
      .run(new Date().toISOString(), JSON.stringify(receipt), actor.tenant, m.id);
    this.repo.event(actor, "purchase.received", m.id, {
      stock: target.id,
      lot: lotId,
      receipt,
      readings,
      source: "vendor-inbound",
      supplierEvidence: "not-connected",
    });
    return this.get(actor, m.id);
  }
}
