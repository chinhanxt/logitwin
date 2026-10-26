import { useState } from "react";
import { IconShieldCheck, IconTemperature } from "@tabler/icons-react";
import type { Role } from "../core/contracts";
import { api, storeName } from "./api";
import type { Overview } from "./api";
export default function ColdChain({ data, role, onRefresh }: { data: Overview; role: Role; onRefresh: () => Promise<void> }) {
  const [store, setStore] = useState("q1"),
    [temperature, setTemperature] = useState(5),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function submit(action: "reading" | "release") {
    setBusy(true);
    setError("");
    try {
      await api(
        action === "reading" ? "/telemetry" : "/telemetry/release",
        "POST",
        action === "reading" ? { store, temperature } : { store, reason },
      );
      await onRefresh();
      setMessage(
        action === "reading" ? "Lõi đã ghi nhận nhiệt độ và kiểm tra chính sách cách ly." : "Đã ghi nhận kiểm tra chất lượng và giải phóng cách ly.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="notice">
        Dữ liệu OT trong màn hình này được nhập để mô phỏng cảm biến. Ngưỡng 2–8°C là chính sách mẫu cho demo, chưa phải quy chuẩn cho từng sản phẩm.
        Nhiệt độ về ngưỡng không tự giải phóng hàng đã cách ly.
      </div>
      <div className="tier-grid">
        {["q1", "q3", "q7"].map((id) => {
          const reading = data.telemetry.find((t) => t.store === id),
            held = data.stocks.filter((s) => s.store === id && s.quality === "hold");
          return (
            <article key={id}>
              <span>
                <IconTemperature size={15} /> {storeName(id)}
              </span>
              <h3>{reading ? `${reading.temperature / 100}°C` : "Chưa có bản ghi"}</h3>
              <p>{held.length ? `${held.length} dòng hàng đang cách ly` : "Không có hàng bị cách ly"}</p>
              <small>{reading ? new Date(reading.created_at).toLocaleString("vi-VN") : "Nguồn: mô phỏng nhập tay"}</small>
            </article>
          );
        })}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>Kiểm chứng luồng cảnh báo → cách ly → kiểm tra</h2>
          <IconShieldCheck size={22} />
        </div>
        <div className="coldchain-form">
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="success" role="status">
              {message}
            </div>
          )}
          <label>
            Cửa hàng
            <select aria-label="Cửa hàng" value={store} onChange={(e) => setStore(e.target.value)}>
              {["q1", "q3", "q7"].map((s) => (
                <option key={s} value={s}>
                  {storeName(s)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nhiệt độ mô phỏng (°C)
            <input type="number" min="-30" max="60" step="0.1" value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} />
          </label>
          <button className="button primary" disabled={busy || role !== "planner"} onClick={() => void submit("reading")}>
            Ghi bản đọc mô phỏng
          </button>
          <label>
            Lý do kiểm tra chất lượng
            <textarea
              rows={3}
              minLength={10}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ghi kết quả kiểm tra và lý do giải phóng cách ly…"
            />
          </label>
          <button
            className="button secondary"
            disabled={busy || role !== "approver" || reason.trim().length < 10}
            onClick={() => void submit("release")}
          >
            Xác nhận kiểm tra & giải phóng
          </button>
          <p>Người lập nhập bản đọc; người phê duyệt ghi kết quả kiểm tra. Lõi chặn đề xuất và nhận hàng khi nguồn hoặc đích bị cách ly.</p>
        </div>
      </section>
    </>
  );
}
