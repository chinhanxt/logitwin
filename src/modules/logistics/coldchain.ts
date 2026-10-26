import { Repository } from "../../core/database.ts";
import { DomainError } from "../../core/contracts.ts";
import type { Actor } from "../../core/contracts.ts";
import { requireRole } from "./decisions.ts";
export class ColdChainService {
  repo: Repository;
  constructor(repo: Repository) {
    this.repo = repo;
  }
  ingest(actor: Actor, store: string, temperature: number) {
    requireRole(actor, ["planner"]);
    if (!["q1", "q3", "q7"].includes(store) || !Number.isFinite(temperature) || temperature < -30 || temperature > 60)
      throw new DomainError(422, "Cửa hàng hoặc nhiệt độ không hợp lệ.");
    return this.repo.transaction(() => {
      const time = new Date().toISOString();
      this.repo.db
        .prepare("INSERT INTO telemetry(tenant,store,temperature,source,created_at) VALUES(?,?,?,?,?)")
        .run(actor.tenant, store, Math.round(temperature * 100), "manual-demo", time);
      const outside = temperature < 2 || temperature > 8;
      if (outside)
        this.repo.db
          .prepare("UPDATE stock SET quality='hold',version=version+1 WHERE tenant=? AND store=? AND quality='clear'")
          .run(actor.tenant, store);
      this.repo.event(actor, outside ? "coldchain.alert" : "coldchain.reading", store, { temperature, source: "manual-demo", policy: "demo-2-8C" });
      return { held: outside, store, temperature };
    });
  }
  release(actor: Actor, store: string, reason: string) {
    requireRole(actor, ["approver"]);
    if (!["q1", "q3", "q7"].includes(store) || reason.trim().length < 10 || reason.length > 500)
      throw new DomainError(422, "Cần cửa hàng hợp lệ và lý do kiểm tra 10–500 ký tự.");
    return this.repo.transaction(() => {
      const latest = this.repo.db
        .prepare("SELECT temperature,created_at FROM telemetry WHERE tenant=? AND store=? ORDER BY id DESC LIMIT 1")
        .get(actor.tenant, store);
      if (
        !latest ||
        Date.now() - Date.parse(String(latest.created_at)) > 300000 ||
        Number(latest.temperature) < 200 ||
        Number(latest.temperature) > 800
      )
        throw new DomainError(409, "Cần nhiệt độ trong ngưỡng trước khi đề nghị giải phóng hàng.");
      const changed = this.repo.db
        .prepare("UPDATE stock SET quality='clear',version=version+1 WHERE tenant=? AND store=? AND quality='hold'")
        .run(actor.tenant, store);
      if (changed.changes) this.repo.event(actor, "coldchain.released", store, { reason, source: "human-quality-check" });
      return { released: Number(changed.changes) };
    });
  }
}
