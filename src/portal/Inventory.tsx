import { IconTruck } from "@tabler/icons-react";
import type { Role } from "../core/contracts";
import type { Overview } from "./api";
import MovementActions, { movementLabel } from "./MovementActions";
import { storeName, money } from "./api";
export default function Inventory({
  data,
  role,
  busy,
  act,
}: {
  data: Overview;
  role: Role;
  busy: boolean;
  act: (path: string, message: string, body?: unknown) => Promise<void>;
}) {
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <h2>Tồn kho & mức phủ nhu cầu</h2>
          <span className="tag">Đơn vị theo sản phẩm</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {["Sản phẩm", "Cửa hàng", "Vật lý", "Đã giữ", "Khả dụng", "Mức phủ", "Hạn dùng", "Chất lượng", "Giá bán"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.stocks.map((s) => {
                const f = data.forecasts.find((f) => f.stockId === s.id)!;
                return (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      <small>
                        {s.id} · v{s.version}
                      </small>
                    </td>
                    <td>{storeName(s.store)}</td>
                    <td>
                      {s.on_hand} {s.unit}
                    </td>
                    <td>{s.reserved}</td>
                    <td>{f.available}</td>
                    <td>
                      <span className={`badge ${f.cover < 2 ? "pending" : "executed"}`}>{f.cover} ngày</span>
                    </td>
                    <td>
                      {s.expires}
                      <details className="lot-details">
                        <summary>{s.lots?.length || 0} lô · FEFO</summary>
                        {s.lots
                          ?.filter((l) => l.on_hand > 0)
                          .map((l) => (
                            <div key={l.id}>
                              <b>{l.batch_id}</b>
                              <small>
                                {l.on_hand} vật lý · {l.reserved} đã giữ · {l.expires}
                              </small>
                              <small>
                                Nguồn {l.origin_stock} / {l.origin_batch}
                              </small>
                            </div>
                          ))}
                      </details>
                    </td>
                    <td>
                      <span className={`badge ${s.quality === "hold" ? "pending" : "executed"}`}>
                        {s.quality === "hold" ? "Đang cách ly" : "Không bị cách ly"}
                      </span>
                    </td>
                    <td>{money(s.price)}₫</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel movements">
        <div className="panel-heading">
          <div>
            <h2>Lệnh điều chuyển & đơn mua</h2>
            <p>Xuất giao ghi giảm tồn nguồn vào hàng đang vận chuyển; nhận hàng ghi tăng tồn đích với chứng từ lô nguồn.</p>
          </div>
        </div>
        {!data.movements.length ? (
          <p className="empty">Lệnh được tạo khi đề xuất đã duyệt được thực thi.</p>
        ) : (
          data.movements.map((m) => (
            <div className="movement" key={m.id}>
              <IconTruck size={22} />
              <div>
                <strong>
                  {m.source} {m.target ? `→ ${m.target}` : "· Đơn mua"}
                </strong>
                <small>
                  {m.quantity} đơn vị · {movementLabel(m)}
                </small>
              </div>
              <MovementActions movement={m} role={role} busy={busy} onAction={act} />
            </div>
          ))
        )}
      </section>
    </>
  );
}
