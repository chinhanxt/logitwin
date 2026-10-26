import type { Actor, Decision } from "./contracts.ts";
import { Repository } from "./database.ts";
export function explain(d: Decision) {
  const p = d.payload;
  return {
    mode: "deterministic",
    title: "Phân tích có đối chiếu số liệu",
    sections: [
      {
        title: "Đề xuất",
        body:
          d.kind === "transfer"
            ? `Điều chuyển ${p.quantity} đơn vị từ ${p.source} đến ${p.target}.`
            : d.kind === "restock"
              ? `Tạo đơn mua ${p.quantity} đơn vị cho ${p.source}.`
              : `Áp dụng giá ${p.unitPrice?.toLocaleString("vi-VN")} đ cho ${p.source}.`,
      },
      { title: "Lý do", body: p.reason },
      {
        title: "Độ tin cậy",
        body: `Baseline từ ${p.forecast.sampleDays} ngày dữ liệu mẫu; chưa hiệu chuẩn xác suất. Biên quan sát ${p.forecast.low}–${p.forecast.high} đơn vị/ngày, không phải khoảng tin cậy thống kê.`,
      },
      { title: "Giả định", body: p.assumptions.join(" ") },
      {
        title: "Việc cần duyệt",
        body: "Người phê duyệt khác người lập kiểm tra chất lượng hàng, số lượng và điều kiện giao. Lõi kiểm tra lại phiên bản tồn kho trước khi thực thi.",
      },
    ],
    evidence: { decisionId: d.id, stockVersion: p.sourceVersion, method: p.forecast.method, createdAt: d.created_at },
  };
}
export function search(repo: Repository, actor: Actor, query: string) {
  const words = query.toLocaleLowerCase("vi").split(/\s+/).filter(Boolean).slice(0, 12);
  const rows = repo.db.prepare("SELECT id,title,body,classification,version,created_at FROM documents WHERE tenant=?").all(actor.tenant);
  return rows
    .map((r) => ({ ...r, score: words.filter((w) => `${r.title} ${r.body}`.toLocaleLowerCase("vi").includes(w)).length }))
    .filter((r) => !words.length || r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}
