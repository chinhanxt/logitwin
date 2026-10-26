import { useEffect, useState } from "react";
import { IconArrowRight, IconBox, IconCheck, IconShieldExclamation, IconTruck, IconX } from "@tabler/icons-react";
import type { Decision, Role, Stock } from "../../core/contracts";
import type { Overview } from "../api";
import { kindName, money, statusName, storeName } from "../api";
import type { Selection, StoreNode } from "./model";
import { movementLabel, relatedDecisions, relatedEvents, stockForMovement } from "./model";
import WorkflowEvidence from "./WorkflowEvidence";
import { StockLots, MovementLots } from "./LotDetails";

export interface InspectorProps {
  data: Overview;
  stores: StoreNode[];
  selection: Selection | null;
  role: Role;
  busy: boolean;
  onSelect: (selection: Selection | null) => void;
  onDecision: (decision: Decision) => void;
  onAction: (path: string, message: string, body?: unknown) => Promise<void>;
}
function StockDetails({ stock, data }: { stock: Stock; data: Overview }) {
  const forecast = data.forecasts.find((f) => f.stockId === stock.id);
  return (
    <>
      <div className="twin-quantity">
        <strong>
          {stock.quality === "hold" ? 0 : stock.on_hand - stock.reserved}
          <small>{stock.unit}</small>
        </strong>
        <span>Khả dụng · {storeName(stock.store)}</span>
      </div>
      <dl className="twin-facts">
        <div>
          <dt>Tồn vật lý</dt>
          <dd>
            {stock.on_hand} {stock.unit}
          </dd>
        </div>
        <div>
          <dt>Đã giữ</dt>
          <dd>
            {stock.reserved} {stock.unit}
          </dd>
        </div>
        <div>
          <dt>Giá bán</dt>
          <dd>{money(stock.price)}₫</dd>
        </div>
        <div>
          <dt>Hạn dùng dòng tồn</dt>
          <dd>{stock.expires}</dd>
        </div>
        <div>
          <dt>Mức phủ dự báo</dt>
          <dd>{forecast ? `${forecast.cover} ngày` : "Chưa có"}</dd>
        </div>
        <div>
          <dt>Phiên bản dữ liệu</dt>
          <dd>v{stock.version}</dd>
        </div>
      </dl>
      <div className={`twin-quality ${stock.quality === "hold" ? "hold" : "clear"}`}>
        <IconShieldExclamation size={17} />
        {stock.quality === "hold" ? "Đang cách ly · lõi chặn chuyển hàng" : "Dòng hàng không bị cách ly"}
      </div>
    </>
  );
}
function actionBlockers(data: Overview, stores: StoreNode[], source: Stock | undefined, target: Stock | undefined) {
  const blockers: string[] = [];
  for (const stock of [source, target]) {
    if (!stock) {
      blockers.push("Không tìm thấy dòng tồn nguồn hoặc đích.");
      continue;
    }
    if (stock.quality === "hold") blockers.push(`${storeName(stock.store)} đang cách ly.`);
    const reading = stores.find((s) => s.id === stock.store)?.reading;
    if (!reading) blockers.push(`${storeName(stock.store)} chưa có bản đọc nhiệt độ.`);
    else {
      const age = Date.parse(data.now) - Date.parse(reading.created_at);
      if (!Number.isFinite(age) || age > 300000 || age < -5000)
        blockers.push(`Bản đọc ${storeName(stock.store)} quá 5 phút hoặc thời gian không hợp lệ.`);
      if (reading.temperature < 200 || reading.temperature > 800) blockers.push(`Nhiệt độ ${storeName(stock.store)} ngoài ngưỡng mẫu 2–8°C.`);
    }
  }
  return [...new Set(blockers)];
}
export default function Inspector({ data, stores, selection, role, busy, onSelect, onDecision, onAction }: InspectorProps) {
  const [reason, setReason] = useState("");
  useEffect(() => setReason(""), [selection?.id]);
  const stock = selection?.kind === "stock" ? data.stocks.find((s) => s.id === selection.id) : undefined;
  const store = selection?.kind === "store" ? stores.find((s) => s.id === selection.id) : undefined;
  const movement = selection?.kind === "movement" ? data.movements.find((m) => m.id === selection.id) : undefined;
  const source = movement ? stockForMovement(data, movement) : undefined;
  const target = movement ? data.stocks.find((s) => s.id === movement.target) : undefined;
  const decisions = relatedDecisions(data, selection);
  const events = relatedEvents(data, selection);
  const blockers = movement?.kind === "transfer" ? actionBlockers(data, stores, source, target) : [];
  const actionable = movement && ["reserved", "in_transit", "ordered"].includes(movement.status);
  return (
    <aside className="twin-inspector" aria-label="Thông tin đối tượng vận hành">
      <div className="twin-inspector-heading">
        <div>
          <span className="eyebrow">TRẠNG THÁI TỪ LÕI</span>
          <h2>{stock?.name || (store ? storeName(store.id) : movement ? "Lệnh vận chuyển" : "Mạng lưới cửa hàng")}</h2>
        </div>
        {selection && (
          <button className="icon-button" aria-label="Bỏ chọn đối tượng" onClick={() => onSelect(null)}>
            <IconX size={18} />
          </button>
        )}
      </div>
      <div className="twin-inspector-body">
        {!selection && (
          <>
            <p className="twin-description">Chọn một cửa hàng, dòng tồn hoặc lệnh chuyển để xem bằng chứng và thao tác qua lõi số.</p>
            <div className="twin-store-list">
              {stores.map((node) => (
                <button key={node.id} onClick={() => onSelect({ kind: "store", id: node.id })}>
                  <span className={`twin-store-dot ${node.held ? "hold" : ""}`} />
                  <div>
                    <strong>{storeName(node.id)}</strong>
                    <small>
                      {node.stocks.length} dòng tồn · {node.held} cách ly
                    </small>
                  </div>
                  <IconArrowRight size={15} />
                </button>
              ))}
            </div>
            <div className="twin-description">
              Kệ và phương tiện là hình minh họa. Số lượng, trạng thái và nhiệt độ trong bảng lấy từ API của chuỗi đang đăng nhập.
            </div>
          </>
        )}
        {stock && (
          <>
            <div className="twin-object-id">{stock.id}</div>
            <StockDetails stock={stock} data={data} />
            <StockLots stock={stock} />
          </>
        )}
        {store && (
          <>
            <div className="twin-store-reading">
              <span>Bản đọc nhiệt độ gần nhất</span>
              <strong>{store.reading ? `${store.reading.temperature / 100}°C` : "Chưa có"}</strong>
              <small>
                {store.reading
                  ? `${new Date(store.reading.created_at).toLocaleString("vi-VN")} · ${store.reading.source}`
                  : "Mở Giám sát chuỗi lạnh để ghi bản đọc mô phỏng."}
              </small>
            </div>
            <dl className="twin-facts">
              <div>
                <dt>Dòng tồn trong cửa hàng</dt>
                <dd>{store.stocks.length}</dd>
              </div>
              <div>
                <dt>Dòng hàng bị cách ly</dt>
                <dd>{store.held}</dd>
              </div>
              <div>
                <dt>Dòng hàng có giữ chỗ</dt>
                <dd>{store.reserved}</dd>
              </div>
            </dl>
            <h3 className="twin-section-title">Dòng tồn · chọn để kiểm tra</h3>
            <div className="twin-stock-list">
              {store.stocks.map((s) => (
                <button key={s.id} onClick={() => onSelect({ kind: "stock", id: s.id })}>
                  <span className={`twin-small-icon ${s.quality === "hold" ? "hold" : ""}`}>
                    <IconBox size={17} />
                  </span>
                  <div>
                    <strong>{s.name}</strong>
                    <small>
                      {s.quality === "hold" ? 0 : s.on_hand - s.reserved} {s.unit} khả dụng{s.quality === "hold" ? " · cách ly" : ""}
                    </small>
                  </div>
                  <IconArrowRight size={15} />
                </button>
              ))}
            </div>
          </>
        )}
        {movement && (
          <>
            <div className="twin-object-id">{movement.id}</div>
            <span className={`twin-status ${movement.status}`}>{movementLabel(movement.status)}</span>
            <div className="twin-shipment-route">
              <span>{storeName(source?.store || movement.source)}</span>
              <IconArrowRight size={18} />
              <span>{target ? storeName(target.store) : "Đơn mua"}</span>
            </div>
            <div className="twin-quantity">
              <strong>
                {movement.quantity}
                <small>{source?.unit || "đơn vị"}</small>
              </strong>
              <span>{source?.name || "Sản phẩm chưa xác định"}</span>
            </div>
            <p className="twin-description">
              {movement.kind === "transfer"
                ? "Đường nối thể hiện quan hệ nguồn–đích. Biểu tượng xe thể hiện trạng thái lệnh, không phải tọa độ GPS."
                : "Đơn mua được tạo từ đề xuất nhập hàng. Nhận hàng và lô nhập được xử lý ở Hàng hóa & điều chuyển."}
            </p>
            <MovementLots movement={movement} unit={source?.unit || "đơn vị"} />
            {actionable && movement.kind === "transfer" && blockers.length > 0 && (
              <div className="twin-blockers">
                <strong>Điều kiện trước khi xuất / nhận</strong>
                {blockers.map((b) => (
                  <p key={b}>{b}</p>
                ))}
                <small>Mở Giám sát chuỗi lạnh để ghi bản đọc mẫu mới và kiểm tra chất lượng. Lõi kiểm tra lại khi thao tác.</small>
              </div>
            )}
            {actionable && (
              <div className="twin-movement-actions">
                {movement.kind === "transfer" && movement.status === "reserved" && (
                  <button
                    className="button primary"
                    disabled={busy || role !== "approver" || blockers.length > 0}
                    onClick={() => void onAction(`/movements/${movement.id}/dispatch`, "Lõi đã ghi nhận xuất phát. Lệnh đang vận chuyển.")}
                  >
                    <IconTruck size={17} />
                    Xác nhận đã xuất phát
                  </button>
                )}
                {movement.kind === "transfer" && movement.status === "in_transit" && (
                  <button
                    className="button secondary"
                    disabled={busy || role !== "approver" || blockers.length > 0}
                    onClick={() => void onAction(`/movements/${movement.id}/receive`, "Đã xác nhận nhận hàng; tồn kho và workflow được cập nhật.")}
                  >
                    <IconCheck size={17} />
                    Xác nhận đã nhận
                  </button>
                )}
                {["reserved", "ordered"].includes(movement.status) && (
                  <>
                    <label>
                      Lý do hủy lệnh
                      <textarea
                        rows={2}
                        minLength={10}
                        maxLength={500}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ghi lý do hủy (ít nhất 10 ký tự)…"
                      />
                    </label>
                    <button
                      className="button secondary"
                      disabled={busy || role !== "approver" || reason.trim().length < 10}
                      onClick={() =>
                        void onAction(`/movements/${movement.id}/cancel`, "Đã hủy lệnh và giải phóng lượng hàng đã giữ.", {
                          reason: reason.trim(),
                        })
                      }
                    >
                      Hủy lệnh
                    </button>
                  </>
                )}
                {role !== "approver" && <small>Thao tác vận chuyển cần vai trò Người phê duyệt.</small>}
              </div>
            )}
          </>
        )}
        {selection && (
          <>
            <h3 className="twin-section-title">Quyết định liên quan</h3>
            {decisions.length ? (
              <div className="twin-related">
                {decisions.slice(0, 4).map((d) => (
                  <button key={d.id} onClick={() => onDecision(d)}>
                    <span>
                      <strong>{kindName[d.kind]}</strong>
                      <small>{statusName[d.status]}</small>
                    </span>
                    <IconArrowRight size={16} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="twin-description">Chưa có đề xuất liên quan trong dữ liệu hiện tại.</p>
            )}
          </>
        )}
        <WorkflowEvidence data={data} selection={selection} />
        <h3 className="twin-section-title">Bằng chứng sự kiện</h3>
        {events.length ? (
          <div className="twin-evidence">
            {events.map((event) => (
              <article key={event.seq}>
                <span className="twin-evidence-dot" />
                <div>
                  <strong>{event.type}</strong>
                  <small>
                    {new Date(event.created_at).toLocaleTimeString("vi-VN")} · #{event.seq}
                  </small>
                  <code>{event.hash.slice(0, 20)}…</code>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="twin-description">Chưa có sự kiện liên quan trong 100 bản ghi gần nhất.</p>
        )}
      </div>
    </aside>
  );
}
