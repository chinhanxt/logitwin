import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveStores,
  operationCounts,
  relatedDecisions,
  relatedEvents,
  resolveSelection,
  stockForMovement,
} from "../src/portal/twin/model.ts";
import type { Overview } from "../src/portal/api.ts";
import type { Decision, Event, Movement, Stock } from "../src/core/contracts.ts";
const now = "2026-10-14T10:00:00.000Z";
function stock(id: string, store: string, overrides: Partial<Stock> = {}): Stock {
  return {
    id,
    store,
    tenant: "test",
    name: id,
    product: id,
    unit: "kg",
    on_hand: 20,
    reserved: 2,
    quality: "clear",
    price: 12000,
    expires: "2026-10-20",
    version: 1,
    history: [3, 5, 6],
    lat: 10,
    lng: 106,
    ...overrides,
  };
}
function movement(id: string, status: Movement["status"]): Movement {
  const result = {
    id,
    decision: "d-transfer",
    kind: "transfer" as const,
    source: "q1-apple",
    target: "q3-apple",
    quantity: 10,
    status,
    tenant: "test",
    created_at: now,
    dispatched_at: null,
    received_at: null,
    cancelled_at: null,
    cancel_reason: null,
    receipt: null,
    lots: [],
  };
  return result;
}
function overview(): Overview {
  return {
    now,
    dataSource: "test fixtures",
    stocks: [stock("q1-apple", "q1"), stock("q3-apple", "q3", { quality: "hold" }), stock("other-apple", "other", { unit: "hộp" })],
    telemetry: [
      { id: 1, store: "q1", temperature: 1000, source: "fixture", created_at: "2026-10-14T09:00:00.000Z" },
      { id: 3, store: "q1", temperature: 500, source: "fixture", created_at: now },
      { id: 2, store: "q1", temperature: 700, source: "fixture", created_at: now },
    ],
    forecasts: [],
    decisions: [],
    events: [],
    movements: [],
  };
}
test("twin derives store identity from authenticated stocks and picks the latest OT record, independent of API ordering", () => {
  const data = overview(),
    stores = deriveStores(data);
  assert.deepEqual(
    stores.map((s) => s.id),
    ["other", "q1", "q3"],
  );
  assert.equal(stores.find((s) => s.id === "q1")?.reading?.temperature, 500);
  assert.equal(stores.find((s) => s.id === "q3")?.held, 1);
  assert.equal(stores.find((s) => s.id === "other")?.reading, undefined);
});
test("refresh removes absent selections and preserves object identity without retaining old object data", () => {
  const data = overview();
  assert.deepEqual(resolveSelection(data, { kind: "stock", id: "q1-apple" }), { kind: "stock", id: "q1-apple" });
  assert.equal(resolveSelection(data, { kind: "stock", id: "removed" }), null);
  assert.equal(resolveSelection(data, { kind: "store", id: "outside-tenant" }), null);
  assert.equal(resolveSelection(data, { kind: "movement", id: "removed" }), null);
});
test("operation counts preserve workflow states and count stock lines without adding mixed product units", () => {
  const data = overview();
  data.movements = (["reserved", "in_transit", "received", "cancelled", "ordered"] as const).map((status, index) =>
    movement(`m${index}`, status),
  );
  const counts = operationCounts(data);
  assert.equal(counts.stockLines, 3);
  assert.equal(counts.reserved, 1);
  assert.equal(counts.travelling, 1);
  assert.equal(counts.received, 1);
  assert.equal(counts.held, 1);
  assert.equal(stockForMovement(data, data.movements[0])?.unit, "kg");
});
test("evidence chain follows actual movement and decision references without unrelated events", () => {
  const data = overview();
  data.decisions = [
    { id: "d-transfer", payload: { source: "q1-apple", target: "q3-apple" } },
    { id: "d-unrelated", payload: { source: "other-apple" } },
  ] as Decision[];
  data.movements = [movement("m1", "in_transit")];
  data.events = [
    { seq: 1, entity: "d-transfer" },
    { seq: 2, entity: "m1" },
    { seq: 3, entity: "d-unrelated" },
  ] as Event[];
  assert.deepEqual(
    relatedDecisions(data, { kind: "movement", id: "m1" }).map((d) => d.id),
    ["d-transfer"],
  );
  assert.deepEqual(
    relatedEvents(data, { kind: "movement", id: "m1" }).map((e) => e.seq),
    [1, 2],
  );
});
