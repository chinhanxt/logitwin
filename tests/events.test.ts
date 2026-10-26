import { test } from "node:test";
import assert from "node:assert/strict";
import { Repository } from "../src/core/database.ts";
import { eventsAfter, parseCursor } from "../src/core/event-stream.ts";
import { verifyAudit } from "../src/core/operations.ts";
test("event replay is ordered and tenant-scoped, with validated cursors", () => {
  const repo = new Repository(":memory:");
  try {
    const a = { id: "p", tenant: "chain-a", role: "planner" as const };
    repo.transaction(() => {
      repo.event(a, "first", "e", {});
      repo.event({ ...a, tenant: "chain-b" }, "private", "other", {});
      repo.event(a, "second", "e", {});
    });
    const replay = eventsAfter(repo, "chain-a", 0);
    assert.deepEqual(
      replay.map((e) => e.type),
      ["first", "second"],
    );
    assert.deepEqual(
      eventsAfter(repo, "chain-a", replay[0].seq).map((e) => e.type),
      ["second"],
    );
    assert.equal(parseCursor("12"), 12);
    assert.throws(() => parseCursor("-1"), /cursor/);
    assert.throws(() => parseCursor("1; DROP"), /cursor/);
  } finally {
    repo.close();
  }
});
test("audit verification detects record edits without claiming immutable storage", () => {
  const repo = new Repository(":memory:");
  try {
    const a = { id: "p", tenant: "chain-a", role: "planner" as const };
    repo.transaction(() => {
      repo.event(a, "first", "e", { value: 1 });
      repo.event(a, "second", "e", { value: 2 });
    });
    assert.equal(verifyAudit(repo, a.tenant).valid, true);
    repo.db.prepare("UPDATE events SET detail=? WHERE type='first'").run('{"value":9}');
    assert.equal(verifyAudit(repo, a.tenant).valid, false);
    assert.equal(verifyAudit(repo, "other").checked, 0);
  } finally {
    repo.close();
  }
});
