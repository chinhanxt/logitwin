import { Engine } from "bpmn-engine";
import type { Execution, BpmnEngineExecutionState } from "bpmn-engine";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { Actor, Decision, Movement } from "./contracts.ts";
import { DomainError } from "./contracts.ts";
import { Repository } from "./database.ts";
import { DecisionService, requireRole } from "../modules/logistics/decisions.ts";
import { MovementService } from "../modules/logistics/movements.ts";
type Kind = "decision" | "movement";
type Action = "approve" | "reject" | "execute" | "dispatch" | "receive" | "cancel";
const version = "26.0.5";
const sources = {
  decision: readFileSync(new URL("../../config/workflows/decision.bpmn", import.meta.url), "utf8"),
  movement: readFileSync(new URL("../../config/workflows/movement.bpmn", import.meta.url), "utf8"),
};
const hashes = {
  decision: createHash("sha256").update(sources.decision).digest("hex"),
  movement: createHash("sha256").update(sources.movement).digest("hex"),
};
interface Checkpoint {
  tenant: string;
  kind: Kind;
  entity: string;
  current_task: string | null;
  state: string;
  revision: number;
  definition_hash: string;
  engine_version: string;
  origin: string;
  updated_at: string;
}
export interface WorkflowSummary {
  kind: Kind;
  entity: string;
  currentTask: string | null;
  revision: number;
  definitionHash: string;
  engineVersion: string;
  origin: string;
  updatedAt: string;
}
function summary(row: Checkpoint): WorkflowSummary {
  return {
    kind: row.kind,
    entity: row.entity,
    currentTask: row.current_task,
    revision: row.revision,
    definitionHash: row.definition_hash,
    engineVersion: row.engine_version,
    origin: row.origin,
    updatedAt: row.updated_at,
  };
}
function signal(execution: Execution, task: string) {
  const waiting = execution.getPostponed().find((api) => api.id === task);
  if (!waiting) throw new DomainError(409, "BPMN đang chờ bước khác. Hãy tải lại dữ liệu.");
  execution.signal({ id: waiting.id, executionId: waiting.executionId });
}
function createEngine(kind: Kind, intent: { action: Action | "" }, staged: { count: number }) {
  return new Engine({
    name: `dxos-${kind}`,
    source: sources[kind],
    settings: { enableDummyService: false },
    services: {
      isApproved: () => intent.action === "approve",
      isExecuteRequested: () => intent.action === "execute",
      isDispatchRequested: () => intent.action === "dispatch",
      prepareCommand: (_scope: unknown, callback: (error: Error | null) => void) => {
        staged.count++;
        callback(null);
      },
    },
  });
}
/** Engine prepares a command and its next checkpoint without external effects.
 * The synchronous domain mutation, checkpoint and audit then commit atomically.
 * Failed mutations discard the prepared engine, leaving the stored wait unchanged. */
export class WorkflowService {
  repo: Repository;
  decisions: DecisionService;
  movements: MovementService;
  locks = new Set<string>();
  constructor(repo: Repository) {
    this.repo = repo;
    this.decisions = new DecisionService(repo);
    this.movements = new MovementService(repo);
    repo.db.exec(
      `CREATE TABLE IF NOT EXISTS workflows(tenant TEXT,kind TEXT,entity TEXT,current_task TEXT,state TEXT,revision INTEGER,definition_hash TEXT,engine_version TEXT,origin TEXT,updated_at TEXT,PRIMARY KEY(tenant,kind,entity))`,
    );
  }
  private row(actor: Actor, kind: Kind, id: string) {
    return this.repo.db.prepare("SELECT * FROM workflows WHERE tenant=? AND kind=? AND entity=?").get(actor.tenant, kind, id) as unknown as
      Checkpoint | undefined;
  }
  list(tenant: string) {
    return (
      this.repo.db.prepare("SELECT * FROM workflows WHERE tenant=? ORDER BY updated_at DESC LIMIT 200").all(tenant) as unknown as Checkpoint[]
    ).map(summary);
  }
  private async initial(actor: Actor, kind: Kind, entity: Decision | Movement) {
    const intent: { action: Action | "" } = { action: "" },
      staged = { count: 0 };
    const engine = createEngine(kind, intent, staged);
    const execution = await engine.execute({ variables: { tenant: actor.tenant, entityId: entity.id, kind } });
    if (kind === "decision") {
      if (entity.status === "approved" || entity.status === "executed") {
        intent.action = "approve";
        signal(execution, "review");
      }
      if (entity.status === "executed") {
        intent.action = "execute";
        signal(execution, "execute");
      }
      if (entity.status === "rejected") {
        intent.action = "reject";
        signal(execution, "review");
      }
    } else {
      if (entity.status === "in_transit") {
        intent.action = "dispatch";
        signal(execution, "dispatch_or_receive");
      } else if (entity.status === "received" || entity.status === "cancelled") {
        intent.action = entity.status === "received" ? "receive" : "cancel";
        signal(execution, "dispatch_or_receive");
      }
    }
    return { engine, execution, intent, staged };
  }
  async attachPending(actor: Actor) {
    for (const entity of this.repo.decisions(actor.tenant).filter((d) => d.status === "pending")) {
      if (this.row(actor, "decision", entity.id)) continue;
      const prepared = await this.initial(actor, "decision", entity);
      this.repo.transaction(() => {
        if (this.row(actor, "decision", entity.id)) return;
        this.write(actor, "decision", entity.id, prepared.execution, 0, "analysis");
        this.repo.event(actor, "workflow.started", entity.id, { kind: "decision", definitionHash: hashes.decision, engineVersion: version });
      });
    }
  }
  private write(actor: Actor, kind: Kind, id: string, execution: Execution, revision: number, origin: string) {
    const task = execution.getPostponed()[0]?.id ?? null;
    if (execution.state === "error" || execution.activityStatus === "executing" || execution.activityStatus === "timer")
      throw new DomainError(500, "BPMN chưa đạt checkpoint ổn định.");
    this.repo.db
      .prepare(
        "INSERT INTO workflows VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant,kind,entity) DO UPDATE SET current_task=excluded.current_task,state=excluded.state,revision=excluded.revision,definition_hash=excluded.definition_hash,engine_version=excluded.engine_version,updated_at=excluded.updated_at",
      )
      .run(actor.tenant, kind, id, task, JSON.stringify(execution.getState()), revision + 1, hashes[kind], version, origin, new Date().toISOString());
  }
  private async apply<T>(actor: Actor, kind: Kind, entity: Decision | Movement, action: Action, mutate: () => T): Promise<T> {
    requireRole(actor, ["approver"]);
    const key = `${actor.tenant}:${kind}:${entity.id}`;
    if (this.locks.has(key)) throw new DomainError(409, "Lệnh workflow đang được xử lý.");
    this.locks.add(key);
    try {
      const row = this.row(actor, kind, entity.id);
      if (row && (row.definition_hash !== hashes[kind] || row.engine_version !== version))
        throw new DomainError(409, "Checkpoint cần nâng phiên bản theo định nghĩa BPMN trước khi tiếp tục.");
      const noChange =
        kind === "decision"
          ? (action === "approve" && entity.status === "approved") ||
            (action === "reject" && entity.status === "rejected") ||
            (action === "execute" && entity.status === "executed")
          : (action === "dispatch" &&
              (entity.status === "in_transit" || (entity.status === "received" && (entity as Movement).dispatched_at !== null))) ||
            (action === "receive" && entity.status === "received") ||
            (action === "cancel" && entity.status === "cancelled");
      if (noChange) return mutate();
      const intent: { action: Action | "" } = { action };
      let staged = { count: 0 };
      let execution: Execution;
      if (row) {
        const engine = createEngine(kind, intent, staged).recover(JSON.parse(row.state) as BpmnEngineExecutionState);
        execution = await engine.resume();
      } else {
        const prepared = await this.initial(actor, kind, entity);
        execution = prepared.execution;
        prepared.intent.action = action;
        staged = prepared.staged;
        staged.count = 0;
      }
      const task =
        kind === "decision"
          ? entity.status === "pending"
            ? "review"
            : "execute"
          : entity.status === "in_transit"
            ? "receive"
            : "dispatch_or_receive";
      signal(execution, task);
      const expected = action === "approve" || action === "reject" ? 0 : 1;
      if (staged.count !== expected) throw new DomainError(500, "BPMN chưa chuẩn bị đúng một lệnh nghiệp vụ.");
      return this.repo.transaction(() => {
        const fresh = this.row(actor, kind, entity.id);
        if ((fresh?.revision ?? 0) !== (row?.revision ?? 0)) throw new DomainError(409, "Checkpoint đã thay đổi; hãy tải lại.");
        const result = mutate();
        this.write(actor, kind, entity.id, execution, row?.revision ?? 0, row?.origin || "domain-state-import");
        this.repo.event(actor, "workflow.task.completed", entity.id, { kind, task, action, definitionHash: hashes[kind], engineVersion: version });
        return result;
      });
    } finally {
      this.locks.delete(key);
    }
  }
  async decision(actor: Actor, id: string, action: "approve" | "reject" | "execute") {
    const entity = this.decisions.get(actor, id);
    return this.apply(actor, "decision", entity, action, () => this.decisions.transition(actor, id, action));
  }
  async movement(actor: Actor, id: string, action: "dispatch" | "receive" | "cancel", input?: unknown) {
    const entity = this.movements.get(actor, id);
    return this.apply(actor, "movement", entity, action, () =>
      action === "dispatch"
        ? this.movements.dispatch(actor, id)
        : action === "receive"
          ? this.movements.receive(actor, id, input)
          : this.movements.cancel(actor, id, input),
    );
  }
}
