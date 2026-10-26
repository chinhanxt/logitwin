import { test } from "node:test";
import assert from "node:assert/strict";
import { Repository } from "../src/core/database.ts";
import { ColdChainService } from "../src/modules/logistics/coldchain.ts";
import { DecisionService, forecast } from "../src/modules/logistics/decisions.ts";
const p = { id: "p", tenant: "demo-chain", role: "planner" as const },
  a = { id: "a", tenant: "demo-chain", role: "approver" as const };
test("temperature excursions quarantine stock and require an authorized quality release", () => {
  const repo = new Repository(":memory:");
  repo.seed();
  try {
    const cold = new ColdChainService(repo);
    const decisions = new DecisionService(repo);
    decisions.generate(p);
    const proposal = repo.decisions(p.tenant).find((d) => d.kind === "transfer")!;
    const store = proposal.payload.source.split("-")[0];
    cold.ingest(p, store, 12);
    const stock = repo.stocks(p.tenant).find((s) => s.id === proposal.payload.source)!;
    assert.equal(stock.quality, "hold");
    assert.equal(forecast(stock).available, 0);
    assert.throws(() => decisions.transition(a, proposal.id, "approve"), /thay đổi/);
    assert.ok(repo.stocks("other-chain").every((s) => s.quality === "clear"));
    assert.throws(() => cold.release(a, store, "Đã kiểm tra chất lượng"), /ngưỡng/);
    cold.ingest(p, store, 5);
    assert.equal(repo.stocks(p.tenant).find((s) => s.id === proposal.payload.source)?.quality, "hold");
    assert.throws(() => cold.release(p, store, "Đã kiểm tra chất lượng"), /Vai trò/);
    cold.release(a, store, "Đã kiểm tra chất lượng hàng trong demo");
    assert.equal(repo.stocks(p.tenant).find((s) => s.id === proposal.payload.source)?.quality, "clear");
  } finally {
    repo.close();
  }
});
