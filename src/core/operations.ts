import { createHash } from "node:crypto";
import { Repository } from "./database.ts";
import type { Event } from "./contracts.ts";
export function verifyAudit(repo: Repository, tenant: string) {
  const rows = repo.db.prepare("SELECT * FROM events WHERE tenant=? ORDER BY seq ASC LIMIT 50001").all(tenant) as unknown as Event[];
  if (rows.length > 50000) return { valid: null, checked: 0, reason: "Vượt giới hạn kiểm tra đồng bộ 50.000 sự kiện." };
  let previous = "genesis";
  for (const row of rows) {
    const computed = createHash("sha256")
      .update(JSON.stringify([row.tenant, row.type, row.actor, row.entity, row.detail, row.created_at, row.previous_hash]))
      .digest("hex");
    if (row.previous_hash !== previous || computed !== row.hash) return { valid: false, checked: rows.indexOf(row), firstInvalid: row.seq };
    previous = row.hash;
  }
  return { valid: true, checked: rows.length, lastHash: previous };
}
export function operationSummary(repo: Repository, tenant: string) {
  return {
    audit: verifyAudit(repo, tenant),
    counts: {
      stockRows: repo.stocks(tenant).length,
      documents: Number(repo.db.prepare("SELECT count(*) AS n FROM documents WHERE tenant=?").get(tenant)?.n || 0),
      events: Number(repo.db.prepare("SELECT count(*) AS n FROM events WHERE tenant=?").get(tenant)?.n || 0),
    },
    auditMeaning: "Kiểm tra chuỗi hash cục bộ; không chứng minh sổ cái bất biến hoặc chống chối bỏ.",
  };
}
