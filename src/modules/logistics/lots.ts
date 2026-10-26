import { randomUUID } from "node:crypto";
import { DomainError } from "../../core/contracts.ts";
import type { MovementLot, StockLot } from "../../core/contracts.ts";
import type { Repository } from "../../core/database.ts";

export const today = () => new Date().toISOString().slice(0, 10);
export function validExpiry(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value && value > today();
}
export function stockLots(repo: Repository, tenant: string, stock: string): StockLot[] {
  return repo.db
    .prepare("SELECT * FROM stock_lots WHERE tenant=? AND stock=? ORDER BY expires,id")
    .all(tenant, stock) as unknown as StockLot[];
}
export function allocations(repo: Repository, tenant: string, movement: string): MovementLot[] {
  return repo.db
    .prepare("SELECT * FROM movement_lots WHERE tenant=? AND movement=? ORDER BY expires,source_lot")
    .all(tenant, movement) as unknown as MovementLot[];
}
export function assertLotBalance(repo: Repository, tenant: string, stock: string) {
  const aggregate = repo.db.prepare("SELECT on_hand,reserved FROM stock WHERE tenant=? AND id=?").get(tenant, stock);
  const sum = stockLots(repo, tenant, stock).reduce(
    (s, l) => ({
      on_hand: s.on_hand + l.on_hand,
      reserved: s.reserved + l.reserved,
    }),
    { on_hand: 0, reserved: 0 },
  );
  if (!aggregate || aggregate.on_hand !== sum.on_hand || aggregate.reserved !== sum.reserved)
    throw new DomainError(409, "Tồn tổng và sổ lô không khớp; cần đối soát trước khi vận hành.");
}
export function reserveLots(repo: Repository, tenant: string, movement: string, stock: string, quantity: number) {
  assertLotBalance(repo, tenant, stock);
  let remaining = quantity;
  for (const lot of stockLots(repo, tenant, stock)) {
    if (lot.expires <= today()) continue;
    const take = Math.min(remaining, lot.on_hand - lot.reserved);
    if (!take) continue;
    repo.db.prepare("UPDATE stock_lots SET reserved=reserved+? WHERE tenant=? AND id=?").run(take, tenant, lot.id);
    repo.db
      .prepare(
        "INSERT INTO movement_lots(tenant,movement,source_lot,batch_id,origin_stock,origin_batch,expires,quantity) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(tenant, movement, lot.id, lot.batch_id, lot.origin_stock, lot.origin_batch, lot.expires, take);
    remaining -= take;
    if (!remaining) break;
  }
  if (remaining) throw new DomainError(409, "Không đủ tồn lô còn hạn dùng để giữ hàng.");
}
export function assertAllocations(
  repo: Repository,
  tenant: string,
  movement: string,
  quantity: number,
  source: string,
  checkReserved: boolean,
  checkExpiry = true,
) {
  const lots = allocations(repo, tenant, movement);
  if (!lots.length || lots.reduce((n, l) => n + l.quantity, 0) !== quantity || (checkExpiry && lots.some((l) => l.expires <= today())))
    throw new DomainError(409, "Lô điều chuyển thiếu chứng từ hoặc đã đến hạn dùng.");
  for (const allocation of lots) {
    const lot = stockLots(repo, tenant, source).find((l) => l.id === allocation.source_lot);
    if (
      !lot ||
      lot.batch_id !== allocation.batch_id ||
      lot.expires !== allocation.expires ||
      (checkReserved && (lot.reserved < allocation.quantity || lot.on_hand < allocation.quantity))
    )
      throw new DomainError(409, "Nguồn lô hoặc lượng giữ hàng đã thay đổi; cần đối soát.");
  }
  return lots;
}
export function removeReservedLots(repo: Repository, tenant: string, lots: MovementLot[], dispatch: boolean) {
  for (const lot of lots)
    repo.db
      .prepare(
        dispatch
          ? "UPDATE stock_lots SET on_hand=on_hand-?,reserved=reserved-? WHERE tenant=? AND id=?"
          : "UPDATE stock_lots SET reserved=reserved-? WHERE tenant=? AND id=?",
      )
      .run(...(dispatch ? [lot.quantity, lot.quantity, tenant, lot.source_lot] : [lot.quantity, tenant, lot.source_lot]));
}
export function addLot(
  repo: Repository,
  tenant: string,
  stock: string,
  data: {
    batchId: string;
    expires: string;
    quantity: number;
    originStock: string;
    originBatch: string;
    movement: string;
  },
) {
  const id = randomUUID();
  repo.db
    .prepare(
      "INSERT INTO stock_lots(id,tenant,stock,batch_id,origin_stock,origin_batch,expires,on_hand,reserved,received_from) VALUES(?,?,?,?,?,?,?,?,0,?)",
    )
    .run(id, tenant, stock, data.batchId, data.originStock, data.originBatch, data.expires, data.quantity, data.movement);
  return id;
}
export function refreshExpiry(repo: Repository, tenant: string, stock: string) {
  // Legacy aggregate is a conservative earliest expiry, not the expiry of every batch.
  const first = repo.db
    .prepare("SELECT MIN(expires) AS expires FROM stock_lots WHERE tenant=? AND stock=? AND on_hand>0")
    .get(tenant, stock);
  if (first?.expires) repo.db.prepare("UPDATE stock SET expires=? WHERE tenant=? AND id=?").run(first.expires, tenant, stock);
}
