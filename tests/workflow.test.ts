import { test } from "node:test";
import assert from "node:assert/strict";
import { Repository } from "../src/core/database.ts";
import { DecisionService } from "../src/modules/logistics/decisions.ts";
import { WorkflowService } from "../src/core/workflow.ts";
import { ColdChainService } from "../src/modules/logistics/coldchain.ts";
const p = { id: "planner", tenant: "demo-chain", role: "planner" as const },
  a = { id: "approver", tenant: "demo-chain", role: "approver" as const };
function setup() {
  const repo = new Repository(":memory:");
  repo.seed();
  const ds = new DecisionService(repo);
  ds.generate(p);
  const cold = new ColdChainService(repo);
  for (const store of ["q1", "q3", "q7"]) cold.ingest(p, store, 5);
  return { repo, ds, workflow: new WorkflowService(repo) };
}
test("real BPMN checkpoint recovers review/execute wait and issues one domain movement", async () => {
  const { repo, workflow } = setup();
  try {
    await workflow.attachPending(p);
    const d = repo.decisions(p.tenant).find((d) => d.kind === "transfer")!;
    assert.equal(workflow.list(p.tenant).find((w) => w.entity === d.id)?.currentTask, "review");
    await workflow.decision(a, d.id, "approve");
    assert.equal(workflow.list(p.tenant).find((w) => w.entity === d.id)?.currentTask, "execute");
    const recovered = new WorkflowService(repo);
    await recovered.decision(a, d.id, "execute");
    assert.equal(recovered.list(p.tenant).find((w) => w.entity === d.id)?.currentTask, null);
    await recovered.decision(a, d.id, "execute");
    assert.equal(repo.movements(p.tenant).filter((m) => m.decision === d.id).length, 1);
  } finally {
    repo.close();
  }
});
test("BPMN failure preserves its checkpoint and prevents unauthorized signals", async () => {
  const { repo, workflow } = setup();
  try {
    await workflow.attachPending(p);
    const d = repo.decisions(p.tenant).find((d) => d.kind === "transfer")!;
    await assert.rejects(workflow.decision(p, d.id, "approve"), /Vai trò/);
    await assert.rejects(workflow.decision({ ...a, tenant: "other-chain" }, d.id, "approve"), /Không tìm/);
    await workflow.decision(a, d.id, "approve");
    const before = workflow.list(p.tenant).find((w) => w.entity === d.id)!;
    repo.db.prepare("UPDATE stock SET version=version+1 WHERE tenant=? AND id=?").run(p.tenant, d.payload.source);
    await assert.rejects(workflow.decision(a, d.id, "execute"), /thay đổi/);
    assert.deepEqual(
      workflow.list(p.tenant).find((w) => w.entity === d.id),
      before,
    );
    assert.equal(repo.movements(p.tenant).length, 0);
    await workflow.decision(a, d.id, "reject");
    assert.equal(workflow.list(p.tenant).find((w) => w.entity === d.id)?.currentTask, null);
  } finally {
    repo.close();
  }
});
test("BPMN movement waits for actual receipt and failed cancellation preserves in-transit state", async () => {
  const { repo, workflow } = setup();
  try {
    const d = repo.decisions(p.tenant).find((d) => d.kind === "transfer")!;
    await workflow.decision(a, d.id, "approve");
    await workflow.decision(a, d.id, "execute");
    const m = repo.movements(p.tenant).find((m) => m.decision === d.id)!;
    await workflow.movement(a, m.id, "dispatch");
    assert.equal(workflow.list(p.tenant).find((w) => w.entity === m.id)?.currentTask, "receive");
    const recovered = new WorkflowService(repo),
      before = recovered.list(p.tenant).find((w) => w.entity === m.id);
    await assert.rejects(recovered.movement(a, m.id, "cancel", "Hủy giao hàng theo yêu cầu"), /hoàn trả/);
    assert.deepEqual(
      recovered.list(p.tenant).find((w) => w.entity === m.id),
      before,
    );
    await recovered.movement(a, m.id, "receive");
    assert.equal(repo.movements(p.tenant).find((x) => x.id === m.id)?.status, "received");
    assert.equal(recovered.list(p.tenant).find((w) => w.entity === m.id)?.currentTask, null);
  } finally {
    repo.close();
  }
});
test("BPMN checkpoint persistence error rolls business state back in outer transaction", async () => {
  const { repo, workflow } = setup();
  try {
    await workflow.attachPending(p);
    const d = repo.decisions(p.tenant).find((d) => d.kind === "transfer")!;
    await workflow.decision(a, d.id, "approve");
    repo.db.exec("CREATE TRIGGER fail_workflow BEFORE UPDATE ON workflows BEGIN SELECT RAISE(FAIL,'checkpoint failure'); END;");
    await assert.rejects(workflow.decision(a, d.id, "execute"), /checkpoint failure/);
    assert.equal(repo.decisions(p.tenant).find((x) => x.id === d.id)?.status, "approved");
    assert.equal(repo.movements(p.tenant).length, 0);
    assert.equal(workflow.list(p.tenant).find((w) => w.entity === d.id)?.currentTask, "execute");
  } finally {
    repo.close();
  }
});
test("BPMN approval and in-transit receipt checkpoints survive actual database close/reopen", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = mkdtempSync(join(tmpdir(), "dxos-bpmn-recovery-")),
    file = join(directory, "core.sqlite");
  let repo: Repository | undefined;
  try {
    repo = new Repository(file);
    repo.seed();
    const d = new DecisionService(repo);
    d.generate(p);
    const cold = new ColdChainService(repo);
    for (const store of ["q1", "q3", "q7"]) cold.ingest(p, store, 5);
    const id = repo.decisions(p.tenant).find((x) => x.kind === "transfer")!.id;
    let workflow = new WorkflowService(repo);
    await workflow.attachPending(p);
    await workflow.decision(a, id, "approve");
    repo.close();
    repo = new Repository(file);
    repo.seed();
    workflow = new WorkflowService(repo);
    assert.equal(workflow.list(p.tenant).find((w) => w.entity === id)?.currentTask, "execute");
    await workflow.decision(a, id, "execute");
    const movement = repo.movements(p.tenant).find((m) => m.decision === id)!;
    await workflow.movement(a, movement.id, "dispatch");
    repo.close();
    repo = new Repository(file);
    repo.seed();
    workflow = new WorkflowService(repo);
    assert.equal(workflow.list(p.tenant).find((w) => w.entity === movement.id)?.currentTask, "receive");
    await workflow.movement(a, movement.id, "receive");
    assert.equal(repo.movements(p.tenant).find((m) => m.id === movement.id)?.status, "received");
    assert.equal(workflow.list(p.tenant).find((w) => w.entity === movement.id)?.currentTask, null);
  } finally {
    repo?.close();
    rmSync(directory, { recursive: true });
  }
});
