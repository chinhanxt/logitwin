import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repository } from "../src/core/database.ts";
import { DecisionService } from "../src/modules/logistics/decisions.ts";
test("workflow and audit survive closing/reopening the database", () => {
  const dir = mkdtempSync(join(tmpdir(), "dxos-persistence-"));
  try {
    const file = join(dir, "core.sqlite");
    let repo = new Repository(file);
    repo.seed();
    new DecisionService(repo).generate({ id: "p", tenant: "demo-chain", role: "planner" });
    const ids = repo.decisions("demo-chain").map((d) => d.id),
      events = repo.events("demo-chain").map((e) => e.hash);
    repo.close();
    repo = new Repository(file);
    assert.deepEqual(
      repo.decisions("demo-chain").map((d) => d.id),
      ids,
    );
    assert.deepEqual(
      repo.events("demo-chain").map((e) => e.hash),
      events,
    );
    assert.equal(repo.decisions("other-chain").length, 0);
    repo.close();
  } finally {
    rmSync(dir, { recursive: true });
  }
});
