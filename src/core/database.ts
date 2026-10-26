import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { seedRows } from "../modules/logistics/seed.ts";
import { legacySop, currentSop } from "../modules/logistics/sop.ts";
import { migrateLots } from "./lot-migration.ts";
import { allocations, stockLots } from "../modules/logistics/lots.ts";
import type { Actor, Decision, Event, Movement, Stock } from "./contracts.ts";
export class Repository {
  db: DatabaseSync;
  private transactionDepth = 0;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;
   CREATE TABLE IF NOT EXISTS stock(id TEXT,tenant TEXT,store TEXT,product TEXT,name TEXT,unit TEXT,on_hand INTEGER CHECK(on_hand>=0),reserved INTEGER CHECK(reserved>=0 AND reserved<=on_hand),price INTEGER,expires TEXT,version INTEGER,history TEXT,lat REAL,lng REAL,PRIMARY KEY(tenant,id));
   CREATE TABLE IF NOT EXISTS decisions(id TEXT PRIMARY KEY,tenant TEXT,kind TEXT,status TEXT,payload TEXT,created_by TEXT,approved_by TEXT,created_at TEXT,updated_at TEXT);
   CREATE TABLE IF NOT EXISTS movements(id TEXT PRIMARY KEY,tenant TEXT,decision TEXT UNIQUE,kind TEXT,source TEXT,target TEXT,quantity INTEGER,status TEXT);
   CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,tenant TEXT,type TEXT,actor TEXT,entity TEXT,detail TEXT,created_at TEXT,previous_hash TEXT,hash TEXT);
   CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,tenant TEXT,title TEXT,body TEXT,classification TEXT,version INTEGER,created_at TEXT);
   CREATE TABLE IF NOT EXISTS telemetry(id INTEGER PRIMARY KEY AUTOINCREMENT,tenant TEXT,store TEXT,temperature INTEGER,source TEXT,created_at TEXT);
   CREATE TABLE IF NOT EXISTS embeddings(id TEXT PRIMARY KEY,tenant TEXT,document TEXT,version INTEGER,chunk TEXT,vector TEXT,model TEXT,created_at TEXT);
   CREATE INDEX IF NOT EXISTS event_tenant ON events(tenant,seq);
   CREATE INDEX IF NOT EXISTS decision_tenant ON decisions(tenant,status);`);
    const columns = this.db.prepare("PRAGMA table_info(stock)").all();
    if (!columns.some((c) => c.name === "quality")) this.db.exec("ALTER TABLE stock ADD COLUMN quality TEXT NOT NULL DEFAULT 'clear'");
    const movementColumns = this.db.prepare("PRAGMA table_info(movements)").all();
    for (const column of ["created_at", "dispatched_at", "received_at", "cancelled_at", "cancel_reason", "receipt"])
      if (!movementColumns.some((c) => c.name === column)) this.db.exec(`ALTER TABLE movements ADD COLUMN ${column} TEXT`);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stock_lots(id TEXT,tenant TEXT,stock TEXT,batch_id TEXT,origin_stock TEXT,origin_batch TEXT,expires TEXT,
        on_hand INTEGER NOT NULL CHECK(on_hand>=0),reserved INTEGER NOT NULL CHECK(reserved>=0 AND reserved<=on_hand),received_from TEXT,
        PRIMARY KEY(tenant,id),FOREIGN KEY(tenant,stock) REFERENCES stock(tenant,id));
      CREATE TABLE IF NOT EXISTS movement_lots(tenant TEXT,movement TEXT,source_lot TEXT,batch_id TEXT,origin_stock TEXT,origin_batch TEXT,expires TEXT,
        quantity INTEGER NOT NULL CHECK(quantity>0),target_lot TEXT,PRIMARY KEY(tenant,movement,source_lot),
        FOREIGN KEY(movement) REFERENCES movements(id),FOREIGN KEY(tenant,source_lot) REFERENCES stock_lots(tenant,id));
      CREATE INDEX IF NOT EXISTS lots_stock ON stock_lots(tenant,stock,expires);
      CREATE INDEX IF NOT EXISTS movements_tenant_status ON movements(tenant,status);
    `);
    this.transaction(() => {
      const documents = this.db.prepare("SELECT id,tenant,version FROM documents WHERE title=? AND body=?").all("SOP hàng tươi · bản mẫu", legacySop);
      for (const d of documents) {
        this.db.prepare("UPDATE documents SET body=?,version=version+1 WHERE tenant=? AND id=?").run(currentSop, d.tenant!, d.id!);
        this.event({ id: "system:fixture-sop-v2", tenant: String(d.tenant), role: "planner" }, "document.fixture-updated", String(d.id), {
          source: "fixture-sop-v2",
          previousVersion: d.version,
        });
      }
    });
    migrateLots(this.db);
  }
  seed() {
    this.transaction(() => {
      for (const tenant of ["demo-chain", "other-chain"]) {
        if (this.db.prepare("SELECT 1 FROM stock WHERE tenant=? LIMIT 1").get(tenant)) continue;
        const insert = this.db.prepare(
          "INSERT INTO stock(id,tenant,store,product,name,unit,on_hand,reserved,price,expires,version,history,lat,lng) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        );
        for (const s of seedRows(tenant))
          insert.run(
            s.id,
            s.tenant,
            s.store,
            s.product,
            s.name,
            s.unit,
            s.on_hand,
            s.reserved,
            s.price,
            s.expires,
            s.version,
            JSON.stringify(s.history),
            s.lat,
            s.lng,
          );
        this.db
          .prepare("INSERT INTO documents VALUES (?,?,?,?,?,?,?)")
          .run(randomUUID(), tenant, "SOP hàng tươi · bản mẫu", currentSop, "internal", 1, new Date().toISOString());
      }
    });
    migrateLots(this.db);
  }
  transaction<T>(fn: () => T): T {
    if (fn.constructor.name === "AsyncFunction")
      throw new Error("Repository transactions must be synchronous; prepare async work before committing.");
    const depth = this.transactionDepth;
    const savepoint = `domain_${depth}`;
    this.db.exec(depth === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${savepoint}`);
    this.transactionDepth++;
    try {
      const result = fn();
      if (result && (typeof result === "object" || typeof result === "function") && "then" in result)
        throw new Error("Repository transactions must be synchronous; prepare async work before committing.");
      this.db.exec(depth === 0 ? "COMMIT" : `RELEASE SAVEPOINT ${savepoint}`);
      return result;
    } catch (error) {
      this.db.exec(depth === 0 ? "ROLLBACK" : `ROLLBACK TO SAVEPOINT ${savepoint}`);
      if (depth !== 0) this.db.exec(`RELEASE SAVEPOINT ${savepoint}`);
      throw error;
    } finally {
      this.transactionDepth--;
    }
  }
  stocks(tenant: string): Stock[] {
    return this.db
      .prepare("SELECT * FROM stock WHERE tenant=? ORDER BY store,product")
      .all(tenant)
      .map(
        (row) =>
          ({
            ...row,
            history: JSON.parse(row.history as string),
            lots: stockLots(this, tenant, String(row.id)),
          }) as Stock,
      );
  }
  movements(tenant: string): Movement[] {
    return this.db
      .prepare("SELECT * FROM movements WHERE tenant=? ORDER BY rowid DESC")
      .all(tenant)
      .map(
        (row) =>
          ({
            ...row,
            receipt: row.receipt ? JSON.parse(String(row.receipt)) : null,
            lots: allocations(this, tenant, String(row.id)),
          }) as Movement,
      );
  }
  decisions(tenant: string): Decision[] {
    return this.db
      .prepare("SELECT * FROM decisions WHERE tenant=? ORDER BY created_at DESC")
      .all(tenant)
      .map((row) => ({ ...row, payload: JSON.parse(row.payload as string) }) as Decision);
  }
  event(actor: Actor, type: string, entity: string, detail: unknown) {
    const last = this.db.prepare("SELECT hash FROM events WHERE tenant=? ORDER BY seq DESC LIMIT 1").get(actor.tenant);
    const previous = (last?.hash as string) || "genesis";
    const time = new Date().toISOString();
    const body = JSON.stringify(detail);
    const hash = createHash("sha256")
      .update(JSON.stringify([actor.tenant, type, actor.id, entity, body, time, previous]))
      .digest("hex");
    this.db
      .prepare("INSERT INTO events(tenant,type,actor,entity,detail,created_at,previous_hash,hash) VALUES(?,?,?,?,?,?,?,?)")
      .run(actor.tenant, type, actor.id, entity, body, time, previous, hash);
  }
  events(tenant: string): Event[] {
    return this.db.prepare("SELECT * FROM events WHERE tenant=? ORDER BY seq DESC LIMIT 100").all(tenant) as unknown as Event[];
  }
  close() {
    this.db.close();
  }
}
