import { test } from "node:test";
import assert from "node:assert/strict";
import type { Movement, Stock } from "../src/core/contracts.ts";
import type { Overview } from "../src/portal/api.ts";
import {
  advanceVisualTime,
  forkliftActivity,
  movementVehicles,
  roundedLoop,
  sampleLoop,
  storeMovements,
  TRUCK_LOOP,
} from "../src/portal/waretrack/motion.ts";

function fixture(statuses: Movement["status"][] = ["reserved", "in_transit", "ordered", "received", "cancelled"]): Overview {
  const stock = (id: string, store: string): Stock => ({
    id,
    store,
    tenant: "example",
    product: "apple",
    name: "Táo",
    unit: "kg",
    quality: "clear",
    on_hand: 12,
    reserved: 3,
    price: 20000,
    expires: "2026-10-20",
    version: 1,
    history: [1, 2, 3],
    lat: 10,
    lng: 106,
  });
  return {
    now: "2026-10-14T12:00:00Z",
    dataSource: "fixtures",
    telemetry: [],
    stocks: [stock("a", "q1"), stock("b", "q3"), stock("c", "q7")],
    decisions: [],
    events: [],
    forecasts: [],
    movements: statuses.map((status, index) => ({
      id: `movement-${index}`,
      tenant: "example",
      decision: `decision-${index}`,
      kind: "transfer",
      source: "a",
      target: "b",
      quantity: 3,
      status,
      created_at: null,
      dispatched_at: null,
      received_at: null,
      cancelled_at: null,
      cancel_reason: null,
      receipt: null,
      lots: [],
    })),
  };
}

const poseDistance = (a: ReturnType<typeof sampleLoop>, b: ReturnType<typeof sampleLoop>) =>
  Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]);
const headingDistance = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

test("rounded visual route closes with continuous position and heading, including the loop boundary", () => {
  const epsilon = 0.000001;
  assert.ok(poseDistance(sampleLoop(TRUCK_LOOP, 0), sampleLoop(TRUCK_LOOP, TRUCK_LOOP.length)) < epsilon);
  for (const boundary of [...TRUCK_LOOP.segments.map((segment) => segment.start), TRUCK_LOOP.length]) {
    const before = sampleLoop(TRUCK_LOOP, boundary - epsilon);
    const after = sampleLoop(TRUCK_LOOP, boundary + epsilon);
    assert.ok(poseDistance(before, after) < epsilon * 3);
    assert.ok(headingDistance(before.yaw, after.yaw) < epsilon * 3);
  }
});

test("route sampling remains finite and inside the site for negative, huge and invalid view distances", () => {
  for (const distance of [-100000, -1, 0, 1, 10000, 1e308, Number.NaN, Number.POSITIVE_INFINITY]) {
    const pose = sampleLoop(TRUCK_LOOP, distance);
    assert.ok([...pose.position, pose.yaw].every(Number.isFinite));
    assert.ok(pose.position[0] >= -18 && pose.position[0] <= 18);
    assert.ok(pose.position[2] >= 12 && pose.position[2] <= 15.6);
  }
  assert.throws(() => roundedLoop(1, 1, 1, 2, 1), RangeError);
  assert.throws(() => roundedLoop(0, 3, 0, 3, 2), RangeError);
});

test("pause and reduced motion preserve visual time; background frames cannot skip across the site", () => {
  assert.equal(advanceVisualTime(5, 0.016, false, false), 5);
  assert.equal(advanceVisualTime(5, 0.016, true, true), 5);
  assert.equal(advanceVisualTime(5, Number.NaN, true, false), 5);
  assert.equal(advanceVisualTime(5, -1, true, false), 5);
  assert.equal(advanceVisualTime(5, 100, true, false), 5.1);
  assert.equal(advanceVisualTime(5, 0.02, true, false), 5.02);
});

test("only actual in-transit movements drive trucks; store scoping includes receiving stores and excludes cancelled orders", () => {
  const data = fixture();
  const vehicles = movementVehicles(data, "q1");
  assert.equal(vehicles.length, 4);
  assert.deepEqual(
    vehicles.filter((vehicle) => vehicle.moving).map((vehicle) => vehicle.movement.id),
    ["movement-1"],
  );
  assert.equal(movementVehicles(data, "q3").length, 4);
  assert.equal(movementVehicles(data, "q7").length, 0);
  assert.equal(movementVehicles(data, "unrelated-store").length, 0);
  assert.ok(!storeMovements(data, "q1").some((movement) => movement.status === "cancelled"));
  data.movements[1].status = "received";
  assert.ok(movementVehicles(data, "q1").every((vehicle) => !vehicle.moving));
});

test("forklift movement requires a real active operation or explicit presentation, and never invents an asset or movement ID", () => {
  const data = fixture(["received", "cancelled"]);
  assert.deepEqual(forkliftActivity(data, "q1", false), {
    animate: false,
    movementId: null,
  });
  assert.deepEqual(forkliftActivity(data, "q1", true), {
    animate: true,
    movementId: null,
  });
  data.movements[0].status = "reserved";
  assert.deepEqual(forkliftActivity(data, "q1", false), {
    animate: true,
    movementId: "movement-0",
  });
  assert.deepEqual(forkliftActivity(data, "q7", false), {
    animate: false,
    movementId: null,
  });
});

test("visual planning and hundreds of motion frames preserve every server status, inventory quantity, timestamp and lot", () => {
  const data = fixture();
  const before = JSON.stringify(data);
  for (const movement of data.movements) Object.freeze(movement);
  for (const stock of data.stocks) Object.freeze(stock);
  Object.freeze(data.movements);
  Object.freeze(data.stocks);
  Object.freeze(data);
  const vehicles = movementVehicles(data, "q1");
  let elapsed = 0;
  for (let frame = 0; frame < 500; frame++) {
    elapsed = advanceVisualTime(elapsed, 1 / 60, true, false);
    for (const vehicle of vehicles) if (vehicle.moving) sampleLoop(TRUCK_LOOP, vehicle.offset + elapsed * 2.5);
    forkliftActivity(data, "q1", false);
  }
  assert.equal(JSON.stringify(data), before);
});

test("vehicle limits and parking capacity keep large actual queues within the scene without overlapping symbols", () => {
  const data = fixture(Array.from({ length: 30 }, () => "ordered"));
  assert.equal(movementVehicles(data, "q1", 0).length, 0);
  assert.ok(movementVehicles(data, "q1", 100).length <= 10);
  const queue = movementVehicles(data, "q1");
  assert.equal(queue.length, 6);
  assert.equal(new Set(queue.map((vehicle) => vehicle.pose.position.join(","))).size, queue.length);
  assert.ok(queue.every((vehicle) => vehicle.pose.position[2] >= -7 && vehicle.pose.position[2] < 10));
});

test("selected movements stay visible beyond the truck cap and inbound parking capacity without accepting unrelated or cancelled IDs", () => {
  const data = fixture(Array.from({ length: 30 }, () => "ordered"));
  const selectedId = "movement-29";
  assert.ok(!movementVehicles(data, "q1").some((vehicle) => vehicle.movement.id === selectedId));
  const selected = movementVehicles(data, "q1", 10, selectedId);
  assert.equal(selected[0].movement.id, selectedId);
  assert.equal(selected.length, 6);
  assert.equal(new Set(selected.map((vehicle) => vehicle.pose.position.join(","))).size, selected.length);
  assert.equal(movementVehicles(data, "q7", 10, selectedId).length, 0);
  data.movements[29].status = "cancelled";
  assert.ok(!movementVehicles(data, "q1", 10, selectedId).some((vehicle) => vehicle.movement.id === selectedId));
  data.movements[29].status = "ordered";
  for (const movement of data.movements.slice(0, 29)) movement.status = "in_transit";
  const mixed = movementVehicles(data, "q1", 10, selectedId);
  assert.equal(mixed[0].movement.id, selectedId);
  assert.equal(mixed.length, 10);
  assert.equal(mixed.filter((vehicle) => vehicle.moving).length, 9);
});
