import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repository } from "../src/core/database.ts";
import type { Actor, Movement } from "../src/core/contracts.ts";
import { DecisionService, forecast } from "../src/modules/logistics/decisions.ts";
import { MovementService } from "../src/modules/logistics/movements.ts";
import { ColdChainService } from "../src/modules/logistics/coldchain.ts";
import { planRoutes } from "../src/modules/logistics/routing.ts";
const planner: Actor = { id: "planner", tenant: "demo-chain", role: "planner" };
const approver: Actor = {
  id: "approver",
  tenant: "demo-chain",
  role: "approver",
};
const expires = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
function setup(path = ":memory:", withReadings = true) {
  const repo = new Repository(path);
  repo.seed();
  const decisions = new DecisionService(repo),
    movements = new MovementService(repo),
    cold = new ColdChainService(repo);
  if (withReadings) for (const store of ["q1", "q3", "q7"]) cold.ingest(planner, store, 4);
  return { repo, decisions, movements, cold };
}
function order(repo: Repository, decisions: DecisionService, kind: "transfer" | "restock") {
  decisions.generate(planner);
  const d = repo.decisions(planner.tenant).find((d) => d.kind === kind)!;
  assert.ok(d);
  decisions.transition(approver, d.id, "approve");
  decisions.transition(approver, d.id, "execute");
  return repo.movements(planner.tenant).find((m) => m.decision === d.id)!;
}
function conserved(repo: Repository) {
  return (
    repo.stocks(planner.tenant).reduce((n, s) => n + s.on_hand, 0) +
    repo
      .movements(planner.tenant)
      .filter((m) => m.kind === "transfer" && m.status === "in_transit")
      .reduce((n, m) => n + m.quantity, 0)
  );
}
function assertBalances(repo: Repository) {
  for (const stock of repo.stocks(planner.tenant)) {
    assert.equal(
      stock.lots!.reduce((n, l) => n + l.on_hand, 0),
      stock.on_hand,
    );
    assert.equal(
      stock.lots!.reduce((n, l) => n + l.reserved, 0),
      stock.reserved,
    );
    assert.ok(stock.reserved >= 0 && stock.on_hand >= stock.reserved);
  }
}
function snapshot(repo: Repository) {
  return {
    stocks: repo.stocks(planner.tenant),
    movements: repo.movements(planner.tenant),
    events: repo.events(planner.tenant),
  };
}
function status(code: number) {
  return (e: unknown) => typeof e === "object" && e !== null && "status" in e && e.status === code;
}

test("dispatch removes source physical/reserved stock; transit and receive conserve quantity with source-batch provenance", () => {
  const { repo, decisions, movements } = setup();
  try {
    const total = conserved(repo),
      m = order(repo, decisions, "transfer");
    const before = repo.stocks(planner.tenant).find((s) => s.id === m.source)!;
    const route = planRoutes(repo, planner, {
      capacityKg: 100,
      maxMinutes: 240,
      speedKph: 20,
    });
    assert.ok(route.stops.some((s) => s.movement === m.id));
    const dispatched = movements.dispatch(approver, m.id);
    assert.equal(dispatched.status, "in_transit");
    assert.ok(dispatched.dispatched_at);
    assert.equal(repo.stocks(planner.tenant).find((s) => s.id === m.source)!.on_hand, before.on_hand - m.quantity);
    assert.equal(repo.stocks(planner.tenant).find((s) => s.id === m.source)!.reserved, before.reserved - m.quantity);
    assert.equal(conserved(repo), total);
    const afterDispatch = snapshot(repo);
    assert.deepEqual(movements.dispatch(approver, m.id), dispatched);
    assert.deepEqual(snapshot(repo), afterDispatch);
    assert.ok(
      !planRoutes(repo, planner, {
        capacityKg: 100,
        maxMinutes: 240,
        speedKph: 20,
      }).stops.some((s) => s.movement === m.id),
    );
    const received = movements.receive(approver, m.id);
    assert.equal(received.status, "received");
    assert.ok(received.received_at);
    assert.equal(conserved(repo), total);
    const target = repo.stocks(planner.tenant).find((s) => s.id === m.target)!;
    for (const allocation of received.lots) {
      const lot = target.lots!.find((l) => l.id === allocation.target_lot)!;
      assert.equal(lot.batch_id, allocation.batch_id);
      assert.equal(lot.origin_stock, allocation.origin_stock);
      assert.equal(lot.expires, allocation.expires);
      assert.equal(lot.received_from, m.id);
    }
    const afterReceipt = snapshot(repo);
    movements.receive(approver, m.id);
    movements.dispatch(approver, m.id);
    assert.deepEqual(snapshot(repo), afterReceipt);
    assertBalances(repo);
  } finally {
    repo.close();
  }
});

test("reserved/ordered cancellation releases only reservations, is idempotent, and in-transit cancellation is forbidden", () => {
  const { repo, decisions, movements, cold } = setup();
  try {
    const total = conserved(repo),
      transfer = order(repo, decisions, "transfer");
    const stock = repo.stocks(planner.tenant).find((s) => s.id === transfer.source)!;
    cold.ingest(planner, stock.store, 12);
    const cancelled = movements.cancel(approver, transfer.id, "Ngừng giao để kiểm tra chất lượng");
    assert.equal(cancelled.status, "cancelled");
    assert.equal(repo.stocks(planner.tenant).find((s) => s.id === transfer.source)!.reserved, 0);
    assert.equal(repo.stocks(planner.tenant).find((s) => s.id === transfer.source)!.quality, "hold");
    assert.equal(conserved(repo), total);
    const after = snapshot(repo);
    movements.cancel(approver, transfer.id, "Ngừng giao để kiểm tra chất lượng");
    assert.deepEqual(snapshot(repo), after);
    assert.throws(() => movements.cancel(approver, transfer.id, "Một lý do hoàn toàn khác"), status(409));
    assert.throws(() => movements.receive(approver, transfer.id), status(409));
    assert.throws(() => movements.dispatch(approver, transfer.id), status(409));
    assert.ok(
      !planRoutes(repo, planner, {
        capacityKg: 100,
        maxMinutes: 240,
        speedKph: 20,
      }).stops.some((s) => s.movement === transfer.id),
    );
    assertBalances(repo);
  } finally {
    repo.close();
  }
  const purchaseSetup = setup();
  try {
    const total = conserved(purchaseSetup.repo),
      po = order(purchaseSetup.repo, purchaseSetup.decisions, "restock");
    assert.equal(purchaseSetup.movements.cancel(approver, po.id, "Nhà cung cấp không thể giao hàng").status, "cancelled");
    assert.equal(conserved(purchaseSetup.repo), total);
    assertBalances(purchaseSetup.repo);
  } finally {
    purchaseSetup.repo.close();
  }
  const other = setup();
  try {
    const transfer = order(other.repo, other.decisions, "transfer");
    other.movements.dispatch(approver, transfer.id);
    const before = snapshot(other.repo);
    assert.throws(() => other.movements.cancel(approver, transfer.id, "Không giao nữa xin hủy lệnh"), /hoàn trả/);
    assert.deepEqual(snapshot(other.repo), before);
  } finally {
    other.repo.close();
  }
});

test("dispatch and receiving require fresh in-range readings and cannot bypass held or expired allocations", () => {
  const { repo, decisions, movements, cold } = setup(":memory:", false);
  try {
    const m = order(repo, decisions, "transfer"),
      before = snapshot(repo);
    assert.throws(() => movements.dispatch(approver, m.id), /5 phút/);
    assert.deepEqual(snapshot(repo), before);
    for (const store of ["q1", "q3", "q7"]) cold.ingest(planner, store, 4);
    const source = repo.stocks(planner.tenant).find((s) => s.id === m.source)!;
    repo.db
      .prepare("UPDATE telemetry SET created_at=? WHERE tenant=? AND store=?")
      .run(new Date(Date.now() - 301000).toISOString(), planner.tenant, source.store);
    assert.throws(() => movements.dispatch(approver, m.id), /5 phút/);
    cold.ingest(planner, source.store, 4);
    movements.dispatch(approver, m.id);
    const target = repo.stocks(planner.tenant).find((s) => s.id === m.target)!;
    cold.ingest(planner, target.store, 12);
    const held = snapshot(repo);
    assert.throws(() => movements.receive(approver, m.id), /cách ly/);
    assert.deepEqual(snapshot(repo), held);
    cold.ingest(planner, target.store, 4);
    cold.release(approver, target.store, "Đã kiểm tra thực phẩm theo quy trình demo");
    // Expired transfer evidence is checked even if aggregate source expiry now differs.
    repo.db.prepare("UPDATE stock SET expires=? WHERE tenant=? AND id=?").run(expires(10), planner.tenant, source.id);
    repo.db.prepare("UPDATE stock_lots SET expires='2000-01-01' WHERE tenant=? AND id=?").run(planner.tenant, m.lots[0].source_lot);
    repo.db.prepare("UPDATE movement_lots SET expires='2000-01-01' WHERE tenant=? AND movement=?").run(planner.tenant, m.id);
    assert.throws(() => movements.receive(approver, m.id), /hạn dùng/);
    assert.equal(movements.get(approver, m.id).status, "in_transit");
  } finally {
    repo.close();
  }
});

test("PO receipt validates full quantity/new batch/expiry and imports external supply once without overwriting batch expiry", () => {
  const { repo, decisions, movements } = setup();
  try {
    const total = conserved(repo),
      m = order(repo, decisions, "restock");
    const original = repo.stocks(planner.tenant).find((s) => s.id === m.source)!;
    for (const receipt of [
      undefined,
      {},
      { batchId: "NCC-1", expires: expires(10), quantity: m.quantity - 1 },
      { batchId: "NCC-1", expires: "2030-02-30", quantity: m.quantity },
      { batchId: "NCC-1", expires: expires(0), quantity: m.quantity },
      { batchId: "NCC-1", expires: expires(10), quantity: 1.5 },
    ])
      assert.throws(() => movements.receive(approver, m.id, receipt), status(422));
    const receipt = {
      batchId: "NCC-2026-001",
      expires: expires(10),
      quantity: m.quantity,
    };
    const received = movements.receive(approver, m.id, receipt);
    assert.equal(received.status, "received");
    assert.deepEqual(received.receipt, receipt);
    const stock = repo.stocks(planner.tenant).find((s) => s.id === m.source)!;
    assert.equal(stock.on_hand, original.on_hand + m.quantity);
    assert.equal(conserved(repo), total + m.quantity); // vendor inbound, not an intra-chain transfer.
    assert.equal(stock.expires, original.expires);
    assert.equal(stock.lots!.find((l) => l.batch_id === receipt.batchId)!.expires, receipt.expires);
    assert.equal(stock.lots!.find((l) => l.batch_id === receipt.batchId)!.received_from, m.id);
    assert.equal(stock.lots!.find((l) => l.batch_id === receipt.batchId)!.origin_stock, "supplier-unverified");
    const after = snapshot(repo);
    movements.receive(approver, m.id, {
      ...receipt,
      batchId: ` ${receipt.batchId} `,
    });
    assert.deepEqual(snapshot(repo), after);
    for (const wrong of [
      { ...receipt, quantity: receipt.quantity + 1 },
      { ...receipt, batchId: "NCC-other" },
      { ...receipt, expires: expires(11) },
      { ...receipt, extra: true },
      undefined,
    ])
      assert.throws(() => movements.receive(approver, m.id, wrong), status(409));
    assert.deepEqual(snapshot(repo), after);
    assertBalances(repo);
  } finally {
    repo.close();
  }
});

test("tenant/role boundaries and product/unit compatibility reject movement writes", () => {
  const { repo, decisions, movements } = setup();
  try {
    const m = order(repo, decisions, "transfer"),
      before = snapshot(repo);
    for (const role of ["viewer", "planner"] as const) {
      assert.throws(() => movements.dispatch({ ...approver, role }, m.id), status(403));
      assert.throws(() => movements.receive({ ...approver, role }, m.id), status(403));
      assert.throws(() => movements.cancel({ ...approver, role }, m.id, "Không thực hiện giao hàng nữa"), status(403));
    }
    assert.throws(() => movements.dispatch({ ...approver, tenant: "other-chain" }, m.id), status(404));
    assert.throws(() => movements.receive({ ...approver, tenant: "other-chain" }, m.id), status(404));
    assert.deepEqual(snapshot(repo), before);
    repo.db.prepare("UPDATE stock SET unit='khác' WHERE tenant=? AND id=?").run(planner.tenant, m.target!);
    assert.throws(() => movements.dispatch(approver, m.id), /đơn vị/);
    assert.throws(() => movements.receive(approver, m.id), /đơn vị/);
    assert.equal(movements.get(approver, m.id).status, "reserved");
  } finally {
    repo.close();
  }
});

test("stale competing decisions cannot reserve source twice; open in-transit transfers still cover target demand", () => {
  const { repo, decisions, movements } = setup();
  try {
    decisions.generate(planner);
    const original = repo.decisions(planner.tenant).find((d) => d.kind === "transfer")!;
    const clone = repo.transaction(() => decisions.create(planner, "transfer", original.payload));
    decisions.transition(approver, original.id, "approve");
    decisions.transition(approver, clone, "approve");
    decisions.transition(approver, original.id, "execute");
    assert.throws(() => decisions.transition(approver, clone, "execute"), /đã thay đổi/);
    const m = repo.movements(planner.tenant).find((m) => m.decision === original.id)!;
    movements.dispatch(approver, m.id);
    for (const d of repo.decisions(planner.tenant).filter((d) => d.status === "pending" || d.status === "approved"))
      decisions.transition(approver, d.id, "reject");
    decisions.generate(planner);
    assert.ok(
      !repo
        .decisions(planner.tenant)
        .some(
          (d) =>
            d.status === "pending" &&
            (d.kind === "transfer" ? d.payload.target : d.kind === "restock" ? d.payload.source : null) === m.target,
        ),
    );
    assertBalances(repo);
  } finally {
    repo.close();
  }
});

test("FEFO reserves distinct incoming lots and preserves per-lot expiry instead of inventing a merged batch", () => {
  const { repo, decisions, movements } = setup();
  try {
    const po = order(repo, decisions, "restock");
    movements.receive(approver, po.id, {
      batchId: "SUPPLY-NEW",
      expires: expires(10),
      quantity: po.quantity,
    });
    const source = repo.stocks(planner.tenant).find((s) => s.id === po.source)!;
    const target = repo.stocks(planner.tenant).find((s) => s.store !== source.store && s.product === source.product)!;
    const quantity = source.on_hand;
    const id = repo.transaction(() =>
      decisions.create(planner, "transfer", {
        source: source.id,
        target: target.id,
        quantity,
        sourceVersion: source.version,
        targetVersion: target.version,
        forecast: forecast(source),
        reason: "Kiểm tra FEFO hai lô",
        assumptions: ["Dữ liệu thử nghiệm"],
      }),
    );
    decisions.transition(approver, id, "approve");
    decisions.transition(approver, id, "execute");
    const m = repo.movements(planner.tenant).find((m) => m.decision === id)!;
    assert.equal(m.lots.length, 2);
    assert.equal(m.lots[0].expires, source.expires);
    assert.equal(m.lots[1].batch_id, "SUPPLY-NEW");
    movements.dispatch(approver, m.id);
    movements.receive(approver, m.id);
    const receivedLots = repo
      .stocks(planner.tenant)
      .find((s) => s.id === target.id)!
      .lots!.filter((l) => l.received_from === m.id);
    assert.equal(receivedLots.length, 2);
    assert.ok(receivedLots.some((l) => l.expires === expires(10)));
    assertBalances(repo);
  } finally {
    repo.close();
  }
});

test("audit failure rolls receiving back; outer workflow checkpoint transaction can roll back nested dispatch", (t) => {
  const { repo, decisions, movements } = setup();
  try {
    const m = order(repo, decisions, "transfer"),
      before = snapshot(repo);
    assert.throws(
      () =>
        repo.transaction(() => {
          movements.dispatch(approver, m.id);
          throw Error("checkpoint failed");
        }),
      /checkpoint/,
    );
    assert.deepEqual(snapshot(repo), before);
    movements.dispatch(approver, m.id);
    const dispatched = snapshot(repo);
    t.mock.method(repo, "event", () => {
      throw Error("audit failure");
    });
    assert.throws(() => movements.receive(approver, m.id), /audit failure/);
    assert.deepEqual(snapshot(repo), dispatched);
    t.mock.restoreAll();
    movements.receive(approver, m.id);
    assertBalances(repo);
    assert.throws(() => repo.transaction(() => Promise.resolve("not synchronous")), /synchronous/);
    repo.transaction(() => repo.transaction(() => assert.equal(repo.movements(planner.tenant)[0].status, "received")));
  } finally {
    repo.close();
  }
});

test("reserved/in-transit/received states and receipts survive reopening with no duplicate baseline or physical inventory", () => {
  const dir = mkdtempSync(join(tmpdir(), "dxos-lifecycle-"));
  try {
    const file = join(dir, "core.sqlite");
    let { repo, decisions, movements } = setup(file);
    const total = conserved(repo),
      m = order(repo, decisions, "transfer"),
      po = order(repo, decisions, "restock");
    const receipt = {
      batchId: "REOPEN-SUPPLY",
      expires: expires(10),
      quantity: po.quantity,
    };
    movements.dispatch(approver, m.id);
    const transit = snapshot(repo);
    repo.close();
    repo = new Repository(file);
    movements = new MovementService(repo);
    assert.deepEqual(snapshot(repo), transit);
    assert.equal(conserved(repo), total);
    movements.receive(approver, m.id);
    movements.receive(approver, po.id, receipt);
    const after = snapshot(repo);
    repo.close();
    repo = new Repository(file);
    movements = new MovementService(repo);
    movements.receive(approver, m.id);
    movements.receive(approver, po.id, receipt);
    assert.deepEqual(snapshot(repo), after);
    assert.equal(conserved(repo), total + po.quantity);
    assertBalances(repo);
    repo.close();
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("legacy database migration preserves aggregate/reservation and labels unknown batch history honestly", () => {
  const dir = mkdtempSync(join(tmpdir(), "dxos-migration-"));
  try {
    const file = join(dir, "legacy.sqlite"),
      old = new DatabaseSync(file);
    old.exec(`CREATE TABLE stock(id TEXT,tenant TEXT,store TEXT,product TEXT,name TEXT,unit TEXT,on_hand INTEGER,reserved INTEGER,price INTEGER,expires TEXT,version INTEGER,history TEXT,lat REAL,lng REAL,PRIMARY KEY(tenant,id));
      CREATE TABLE movements(id TEXT PRIMARY KEY,tenant TEXT,decision TEXT UNIQUE,kind TEXT,source TEXT,target TEXT,quantity INTEGER,status TEXT);`);
    for (const tenant of ["demo-chain", "other-chain"]) {
      old
        .prepare("INSERT INTO stock VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .run("source", tenant, "q1", "milk", "Sữa", "hộp", 40, 8, 28000, expires(6), 4, "[10,10]", 10.7, 106.7);
      old
        .prepare("INSERT INTO stock VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .run("target", tenant, "q3", "milk", "Sữa", "hộp", 12, 0, 28000, expires(8), 4, "[10,10]", 10.8, 106.8);
    }
    old
      .prepare("INSERT INTO movements VALUES(?,?,?,?,?,?,?,?)")
      .run("legacy-reserved", "demo-chain", "old-decision", "transfer", "source", "target", 8, "reserved");
    old
      .prepare("INSERT INTO movements VALUES(?,?,?,?,?,?,?,?)")
      .run("legacy-received", "demo-chain", "old-received", "transfer", "source", "target", 2, "received");
    old.close();
    let repo = new Repository(file);
    assert.equal(repo.stocks(planner.tenant).find((s) => s.id === "source")!.reserved, 8);
    const m = new MovementService(repo).get(approver, "legacy-reserved");
    assert.equal(m.lots[0].batch_id, "legacy:source");
    assert.equal(m.created_at, null);
    assert.equal(new MovementService(repo).get(approver, "legacy-received").lots.length, 0); // old receipt has no evidence to reconstruct.
    assert.equal(repo.stocks("other-chain").find((s) => s.id === "source")!.lots![0].reserved, 8);
    new MovementService(repo).cancel(approver, m.id, "Hủy lệnh cũ để đối soát lô hàng");
    assertBalances(repo);
    const after = snapshot(repo);
    repo.close();
    repo = new Repository(file);
    assert.deepEqual(snapshot(repo), after);
    repo.close();
  } finally {
    rmSync(dir, { recursive: true });
  }
});
