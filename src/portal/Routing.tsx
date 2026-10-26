import { useState } from "react";
import { IconMapPin, IconRoute, IconTruck } from "@tabler/icons-react";
import { api, storeName } from "./api";
import type { RoutePlan } from "../modules/logistics/routing";
export default function Routing() {
  const [capacityKg, setCapacity] = useState(25),
    [maxMinutes, setTime] = useState(90),
    [speedKph, setSpeed] = useState(20),
    [plan, setPlan] = useState<RoutePlan | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function preview(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setPlan(await api<RoutePlan>("/routes/preview", "POST", { capacityKg, maxMinutes, speedKph }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="routing-grid">
      <form className="panel route-form" onSubmit={preview}>
        <div className="panel-heading">
          <h2>Điều kiện chuyến giao</h2>
          <IconTruck size={23} />
        </div>
        <div className="route-form-body">
          <p>Xem trước tuyến từ các lệnh điều chuyển đã giữ hàng. Một xe xuất phát tại Quận 1.</p>
          <label>
            Sức chứa xe (kg)
            <input type="number" min="1" max="1000" step="0.5" required value={capacityKg} onChange={(e) => setCapacity(Number(e.target.value))} />
          </label>
          <label>
            Thời gian tối đa (phút)
            <input type="number" min="10" max="480" required value={maxMinutes} onChange={(e) => setTime(Number(e.target.value))} />
          </label>
          <label>
            Vận tốc giả định (km/h)
            <input type="number" min="5" max="60" required value={speedKph} onChange={(e) => setSpeed(Number(e.target.value))} />
          </label>
          <button className="button primary" disabled={busy}>
            <IconRoute size={18} />
            {busy ? "Đang lập tuyến…" : "Xem trước tuyến"}
          </button>
          <small>Baseline greedy · chưa tích hợp PACO</small>
        </div>
      </form>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Lộ trình đề xuất</h2>
            <p>
              {plan
                ? `${plan.distanceKm} km ước tính · ${plan.minutes} phút · ${plan.stops.length} điểm`
                : "Tính toán giới hạn sức chứa và thời gian trước khi giao"}
            </p>
          </div>
          <span className="tag">Bản xem trước</span>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!plan ? (
          <div className="empty">
            <IconRoute size={35} />
            <h3>Sẵn sàng lập tuyến</h3>
            <p>Duyệt và thực thi đề xuất điều chuyển để có lệnh đang giữ hàng.</p>
          </div>
        ) : (
          <>
            <div className="route-stops">
              {plan.stops.map((s, i) => (
                <article key={`${s.movement}-${s.action}`}>
                  <span className={`stop-icon ${s.action}`}>
                    <IconMapPin size={18} />
                  </span>
                  <div>
                    <small>
                      ĐIỂM {i + 1} · PHÚT {s.minute}
                    </small>
                    <h3>{storeName(s.store)}</h3>
                    <p>
                      {s.action === "pickup" ? "Nhận tại nguồn" : "Giao tại đích"} · {s.quantity} đơn vị · {s.weightKg} kg
                    </p>
                  </div>
                  <span className="tag">Tải {s.loadKg} kg</span>
                </article>
              ))}
              {!plan.stops.length && <p className="empty">Chưa có lệnh giữ hàng phù hợp để xếp tuyến.</p>}
            </div>
            {plan.unassigned.length > 0 && (
              <div className="unassigned">
                <h3>Lệnh chưa xếp được</h3>
                {plan.unassigned.map((u) => (
                  <p key={u.movement}>
                    {u.movement.slice(0, 8)} · {u.reason}
                  </p>
                ))}
              </div>
            )}
            <div className="notice">
              {plan.assumptions.map((a) => (
                <p key={a}>{a}</p>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
