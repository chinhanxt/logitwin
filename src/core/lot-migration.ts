import type { DatabaseSync } from "node:sqlite";
/** Aggregate history has no per-batch evidence. One explicitly named legacy lot is
 * created per stock row, with the old expiry preserved. No supplier batch is invented. */
export function migrateLots(db: DatabaseSync) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const stocks = db.prepare("SELECT * FROM stock").all();
    for (const s of stocks) {
      if (db.prepare("SELECT 1 FROM stock_lots WHERE tenant=? AND stock=? LIMIT 1").get(s.tenant!, s.id!)) continue;
      const id = `legacy:${s.id}`;
      db.prepare(
        "INSERT INTO stock_lots(id,tenant,stock,batch_id,origin_stock,origin_batch,expires,on_hand,reserved,received_from) VALUES(?,?,?,?,?,?,?,?,?,NULL)",
      ).run(id, s.tenant!, s.id!, id, s.id!, id, s.expires!, s.on_hand!, s.reserved!);
    }
    const movements = db.prepare("SELECT * FROM movements WHERE kind='transfer' AND status='reserved'").all();
    for (const m of movements) {
      if (db.prepare("SELECT 1 FROM movement_lots WHERE tenant=? AND movement=? LIMIT 1").get(m.tenant!, m.id!)) continue;
      const lot = db
        .prepare("SELECT * FROM stock_lots WHERE tenant=? AND stock=? AND id=?")
        .get(m.tenant!, m.source!, `legacy:${m.source}`);
      if (!lot) throw Error("Legacy reserved movement has no aggregate source lot.");
      const used = db
        .prepare("SELECT COALESCE(SUM(quantity),0) AS n FROM movement_lots WHERE tenant=? AND source_lot=?")
        .get(m.tenant!, lot.id!);
      if (Number(used?.n) + Number(m.quantity) > Number(lot.reserved))
        throw Error("Legacy reservations need reconciliation before lot migration.");
      db.prepare(
        "INSERT INTO movement_lots(tenant,movement,source_lot,batch_id,origin_stock,origin_batch,expires,quantity) VALUES(?,?,?,?,?,?,?,?)",
      ).run(m.tenant!, m.id!, lot.id!, lot.batch_id!, lot.origin_stock!, lot.origin_batch!, lot.expires!, m.quantity!);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
