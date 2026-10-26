import { test } from "node:test";
import assert from "node:assert/strict";
import { Repository } from "../src/core/database.ts";
import { ColdChainService } from "../src/modules/logistics/coldchain.ts";
import { DecisionService } from "../src/modules/logistics/decisions.ts";
import type { Actor } from "../src/core/contracts.ts";
const planner: Actor = { id: "planner", tenant: "demo-chain", role: "planner" },
  approver: Actor = { id: "approver", tenant: "demo-chain", role: "approver" };
function setup() {
  const repo = new Repository(":memory:");
  repo.seed();
  for (const store of ["q1", "q3", "q7"]) new ColdChainService(repo).ingest(planner, store, 4);
  return { repo, service: new DecisionService(repo) };
}
test("approve/execute/receive are persistent, idempotent and conserve physical stock", () => {
  const { repo, service } = setup();
  try {
    service.generate(planner);
    const d = repo.decisions(planner.tenant).find((d) => d.kind === "transfer")!;
    const before = repo.stocks(planner.tenant).reduce((sum, s) => sum + s.on_hand, 0);
    service.transition(approver, d.id, "approve");
    service.transition(approver, d.id, "execute");
    service.transition(approver, d.id, "execute");
    assert.equal(repo.db.prepare("SELECT count(*) AS n FROM movements WHERE decision=?").get(d.id)?.n, 1);
    assert.equal(
      repo.stocks(planner.tenant).reduce((sum, s) => sum + s.on_hand, 0),
      before,
    );
    const movement = repo.db.prepare("SELECT id FROM movements WHERE decision=?").get(d.id)!;
    service.receive(approver, String(movement.id));
    service.receive(approver, String(movement.id));
    assert.equal(
      repo.stocks(planner.tenant).reduce((sum, s) => sum + s.on_hand, 0),
      before,
    );
    assert.equal(repo.stocks(planner.tenant).find((s) => s.id === d.payload.source)?.reserved, 0);
  } finally {
    repo.close();
  }
});
test("tenant isolation, separation of duties, viewer permissions and state constraints", () => {
  const { repo, service } = setup();
  try {
    service.generate(planner);
    const d = repo.decisions(planner.tenant)[0];
    assert.throws(() => service.get({ ...approver, tenant: "other-chain" }, d.id), /Không tìm/);
    assert.throws(() => service.transition({ ...approver, id: "planner" }, d.id, "approve"), /tự duyệt/);
    assert.throws(() => service.generate({ ...planner, role: "viewer" }), /Vai trò/);
    assert.throws(() => service.transition(approver, d.id, "execute"), /Trạng thái/);
    assert.equal(repo.events("other-chain").length, 0);
  } finally {
    repo.close();
  }
});
test("stale stock and expired lots cannot execute; transaction leaves no movement", () => {
  const { repo, service } = setup();
  try {
    service.generate(planner);
    const d = repo.decisions(planner.tenant).find((d) => d.kind === "transfer")!;
    service.transition(approver, d.id, "approve");
    repo.db.prepare("UPDATE stock SET version=version+1 WHERE tenant=? AND id=?").run(planner.tenant, d.payload.source);
    assert.throws(() => service.transition(approver, d.id, "execute"), /đã thay đổi/);
    assert.equal(repo.db.prepare("SELECT count(*) AS n FROM movements").get()?.n, 0);
    assert.equal(service.get(approver, d.id).status, "approved");
  } finally {
    repo.close();
  }
});
test("restock creates an order without inflating physical inventory; reruns do not duplicate pending proposals", () => {
  const { repo, service } = setup();
  try {
    service.generate(planner);
    const count = repo.decisions(planner.tenant).length;
    service.generate(planner);
    assert.equal(repo.decisions(planner.tenant).length, count);
    const d = repo.decisions(planner.tenant).find((d) => d.kind === "restock")!;
    assert.ok(d);
    const before = repo.stocks(planner.tenant).find((s) => s.id === d.payload.source)!.on_hand;
    service.transition(approver, d.id, "approve");
    service.transition(approver, d.id, "execute");
    assert.equal(repo.stocks(planner.tenant).find((s) => s.id === d.payload.source)!.on_hand, before);
  } finally {
    repo.close();
  }
});
test("stale approved decisions can be rejected and analysis can recover", () => {
  const { repo, service } = setup();
  try {
    service.generate(planner);
    const d = repo.decisions(planner.tenant)[0];
    service.transition(approver, d.id, "approve");
    repo.db.prepare("UPDATE stock SET version=version+1 WHERE tenant=? AND id=?").run(planner.tenant, d.payload.source);
    assert.throws(() => service.transition(approver, d.id, "execute"), /đã thay đổi/);
    service.transition(approver, d.id, "reject");
    for (const pending of repo.decisions(planner.tenant).filter((d) => d.status === "pending"))
      service.transition(approver, pending.id, "reject");
    assert.ok(service.generate(planner).created > 0);
  } finally {
    repo.close();
  }
});
test("one analysis has no conflicting stock writes and open inbound is not ordered twice", () => {
  const { repo, service } = setup();
  try {
    service.generate(planner);
    for (const d of repo.decisions(planner.tenant)) {
      service.transition(approver, d.id, "approve");
      service.transition(approver, d.id, "execute");
    }
    const incoming = repo.db
      .prepare("SELECT target FROM movements WHERE kind='transfer' AND status='reserved'")
      .all()
      .map((m) => m.target);
    service.generate(planner);
    for (const d of repo.decisions(planner.tenant).filter((d) => d.status === "pending")) {
      assert.ok(!incoming.includes(d.kind === "transfer" ? d.payload.target! : d.payload.source));
      if (d.kind === "markdown")
        assert.ok(
          !repo
            .decisions(planner.tenant)
            .some((old) => old.status === "executed" && old.kind === "markdown" && old.payload.source === d.payload.source),
        );
    }
  } finally {
    repo.close();
  }
});
test("expired source cannot be approved even if version is unchanged", () => {
  const { repo, service } = setup();
  try {
    service.generate(planner);
    const d = repo.decisions(planner.tenant).find((d) => d.kind === "transfer")!;
    repo.db.prepare("UPDATE stock SET expires=? WHERE tenant=? AND id=?").run("2000-01-01", planner.tenant, d.payload.source);
    assert.throws(() => service.transition(approver, d.id, "approve"), /hết hạn/);
    assert.equal(service.get(planner, d.id).status, "pending");
  } finally {
    repo.close();
  }
});
