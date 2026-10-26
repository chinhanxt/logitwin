import { useState } from "react";
import { IconCheck, IconPlayerPlay, IconX } from "@tabler/icons-react";
import type { Movement, Role } from "../core/contracts";
type Action = (path: string, message: string, body?: unknown) => Promise<void>;
export function movementLabel(m: Movement) {
  return { reserved: "Đã giữ tại nguồn", in_transit: "Đang vận chuyển", ordered: "Đơn mua chờ nhận", received: "Đã nhận", cancelled: "Đã hủy" }[
    m.status
  ];
}
export default function MovementActions({ movement: m, role, busy, onAction }: { movement: Movement; role: Role; busy: boolean; onAction: Action }) {
  const [mode, setMode] = useState<"receipt" | "cancel" | null>(null),
    [batch, setBatch] = useState(""),
    [expires, setExpiry] = useState(""),
    [reason, setReason] = useState("");
  const writable = role === "approver" && !busy;
  return (
    <div className="movement-actions">
      <div className="movement-action-buttons">
        {m.kind === "transfer" && m.status === "reserved" && (
          <button
            className="button primary"
            disabled={!writable}
            onClick={() => void onAction(`/movements/${m.id}/dispatch`, "Đã xuất giao. Hàng chuyển sang tồn đang vận chuyển.")}
          >
            <IconPlayerPlay size={15} />
            Xuất giao
          </button>
        )}
        {m.kind === "transfer" && m.status === "in_transit" && (
          <button
            className="button secondary"
            disabled={!writable}
            onClick={() => void onAction(`/movements/${m.id}/receive`, "Đã nhận hàng tại đích và giữ nguồn gốc lô.")}
          >
            <IconCheck size={15} />
            Xác nhận đã nhận
          </button>
        )}
        {m.kind === "restock" && m.status === "ordered" && (
          <button className="button secondary" disabled={!writable} onClick={() => setMode(mode === "receipt" ? null : "receipt")}>
            Nhận lô nhập
          </button>
        )}
        {["reserved", "ordered"].includes(m.status) && (
          <button className="button secondary" disabled={!writable} onClick={() => setMode(mode === "cancel" ? null : "cancel")}>
            <IconX size={14} />
            Hủy lệnh
          </button>
        )}
      </div>
      {mode === "receipt" && m.status === "ordered" && (
        <form
          className="receipt-form"
          onSubmit={(e) => {
            e.preventDefault();
            void onAction(`/movements/${m.id}/receive`, "Đã nhận đơn mua vào lô mới.", { batchId: batch, expires, quantity: m.quantity });
          }}
        >
          <label>
            Mã lô nhập
            <input value={batch} onChange={(e) => setBatch(e.target.value)} required maxLength={100} placeholder="Ví dụ NCC-2026-001" />
          </label>
          <label>
            Hạn dùng lô nhập
            <input
              type="date"
              value={expires}
              onChange={(e) => setExpiry(e.target.value)}
              required
              min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
            />
          </label>
          <small>Nhận đủ {m.quantity} đơn vị; chưa hỗ trợ nhận từng phần. Cần nhiệt độ cửa hàng trong ngưỡng ở 5 phút gần nhất.</small>
          <button className="button primary" disabled={!writable}>
            Xác nhận nhận lô
          </button>
        </form>
      )}
      {mode === "cancel" && ["reserved", "ordered"].includes(m.status) && (
        <form
          className="receipt-form"
          onSubmit={(e) => {
            e.preventDefault();
            void onAction(`/movements/${m.id}/cancel`, "Đã hủy lệnh và giải phóng lượng hàng đã giữ.", { reason });
          }}
        >
          <label>
            Lý do hủy lệnh
            <textarea minLength={10} maxLength={500} required rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button className="button secondary" disabled={!writable}>
            Xác nhận hủy lệnh
          </button>
        </form>
      )}
      {m.status === "in_transit" && <small>Hàng đã xuất giao; cần quy trình hoàn trả riêng nếu không thể giao.</small>}
    </div>
  );
}
