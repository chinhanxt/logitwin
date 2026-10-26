import type { Overview } from "../api";
import type { Selection } from "./model";
import { relatedDecisions } from "./model";
const names: Record<string, string> = {
  review: "Chờ người phê duyệt",
  execute: "Chờ phát lệnh thực thi",
  dispatch_or_receive: "Chờ xuất/nhận/hủy lệnh",
  receive: "Chờ xác nhận nhận hàng",
};
export default function WorkflowEvidence({ data, selection }: { data: Overview; selection: Selection | null }) {
  const ids = new Set(relatedDecisions(data, selection).map((d) => d.id));
  if (selection) ids.add(selection.id);
  const rows = (data.workflows || []).filter((w) => !selection || ids.has(w.entity)).slice(0, 4);
  return (
    <>
      <h3 className="twin-section-title">Checkpoint BPMN</h3>
      {rows.length ? (
        <div className="twin-workflow-evidence">
          {rows.map((w) => (
            <article key={`${w.kind}-${w.entity}`}>
              <strong>{w.currentTask ? names[w.currentTask] || w.currentTask : "Đã kết thúc quy trình"}</strong>
              <small>
                {w.kind === "decision" ? "Quyết định" : "Lệnh hàng"} · {w.entity.slice(0, 8)} · v{w.revision}
              </small>
              <code>
                bpmn-engine {w.engineVersion} · {w.definitionHash.slice(0, 12)}
              </code>
              {w.origin === "domain-state-import" && <small>Khởi tạo từ trạng thái nghiệp vụ đã có</small>}
            </article>
          ))}
        </div>
      ) : (
        <p className="twin-description">Checkpoint xuất hiện khi phân tích hoặc thao tác qua workflow.</p>
      )}
    </>
  );
}
