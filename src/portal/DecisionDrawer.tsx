import { useEffect, useRef } from "react";
import { IconX, IconSparkles, IconLoader2, IconCheck, IconPlayerPlay } from "@tabler/icons-react";
import type { Decision, Role } from "../core/contracts";
import type { Explanation } from "./api";
import { kindName, statusName } from "./api";
export default function DecisionDrawer({
  selected,
  explanation,
  role,
  busy,
  onClose,
  act,
}: {
  selected: Decision;
  explanation: Explanation | null;
  role: Role;
  busy: boolean;
  onClose: () => void;
  act: (path: string, message: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled),a,input,select,textarea") || []);
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <div className="drawer-backdrop" onClick={() => onClose()}>
      <section ref={dialog} className="drawer" role="dialog" aria-modal="true" aria-label="Chi tiết đề xuất" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-heading">
          <span className="eyebrow">INTELLIGENCE / QUYẾT ĐỊNH</span>
          <button className="icon-button" onClick={() => onClose()} aria-label="Đóng chi tiết">
            <IconX />
          </button>
        </div>
        <h2>{kindName[selected.kind]}</h2>
        <span className={`badge ${selected.status}`}>{statusName[selected.status]}</span>
        <div className="explain-mode">
          <IconSparkles size={20} />
          <div>
            Giải thích dựa trên số liệu<small>Logic xác định · chưa dùng LLM</small>
          </div>
        </div>
        {explanation ? (
          explanation.sections.map((s, i) => (
            <article className="explanation" key={s.title}>
              <span>0{i + 1}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </article>
          ))
        ) : (
          <p>
            <IconLoader2 /> Đang lấy bằng chứng…
          </p>
        )}
        <div className="evidence">
          <b>Nguồn đối chiếu</b>
          <small>Đề xuất: {selected.id}</small>
          <small>Phiên bản tồn nguồn: {selected.payload.sourceVersion}</small>
          <small>Phương pháp: {selected.payload.forecast.method}</small>
        </div>
        <div className="drawer-actions">
          {selected.status === "pending" && (
            <>
              <button
                className="button secondary"
                disabled={role !== "approver" || busy}
                onClick={() => void act(`/decisions/${selected.id}/reject`, "Đã từ chối đề xuất.")}
              >
                Từ chối
              </button>
              <button
                className="button primary"
                disabled={role !== "approver" || busy}
                onClick={() => void act(`/decisions/${selected.id}/approve`, "Đã phê duyệt. Đề xuất sẵn sàng thực thi.")}
              >
                <IconCheck size={17} />
                Phê duyệt
              </button>
            </>
          )}
          {selected.status === "approved" && (
            <>
              <button
                className="button secondary"
                disabled={role !== "approver" || busy}
                onClick={() => void act(`/decisions/${selected.id}/reject`, "Đã hủy đề xuất đã duyệt.")}
              >
                Hủy đề xuất
              </button>
              <button
                className="button primary"
                disabled={role !== "approver" || busy}
                onClick={() => void act(`/decisions/${selected.id}/execute`, "Lõi đã thực thi và ghi nhật ký.")}
              >
                <IconPlayerPlay size={17} />
                Thực thi ở lõi
              </button>
            </>
          )}
          {role !== "approver" && ["pending", "approved"].includes(selected.status) && <p>Tài khoản Người phê duyệt mới được xử lý đề xuất.</p>}
        </div>
      </section>
    </div>
  );
}
