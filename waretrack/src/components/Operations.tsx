import { useState } from "react";
import { IconArrowRight, IconDownload, IconX } from "@tabler/icons-react";
import { useWarehouse } from "../data/store";
import { Badge } from "./Inspector";
import type { Shipment } from "../data/model";
function exportShipments(shipments: Shipment[]) {
  const header = ["Mã lô hàng", "Điểm đến", "Pallet", "Khối lượng", "ETA", "Trạng thái"];
  const rows = shipments.map((s) => [s.id, s.destination, String(s.pallets), s.weight, s.eta, s.status]);
  const csv = "\uFEFF" + [header, ...rows].map((row) => row.map((v) => `"${v.replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "waretrack-shipments.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function DataDrawer({ mode, close }: { mode: "shipments" | "inventory"; close: () => void }) {
  const s = useWarehouse();
  const [query, setQuery] = useState("");
  const q = query.trim().toLocaleLowerCase("vi");
  const shipments = s.shipments.filter(
    (sh) =>
      sh.siteId === s.siteId &&
      (s.filter === "all" || sh.status === s.filter) &&
      `${sh.id} ${sh.destination}`.toLocaleLowerCase("vi").includes(q),
  );
  const items = s.inventory.filter((i) => i.siteId === s.siteId && `${i.sku} ${i.name} ${i.location}`.toLocaleLowerCase("vi").includes(q));
  return (
    <div className="drawer-backdrop" onClick={close}>
      <section
        className="data-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "shipments" ? "Danh sách lô hàng" : "Tồn kho"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <span className="eyebrow">KHÔNG GIAN VẬN HÀNH</span>
            <h2>{mode === "shipments" ? "Tất cả lô hàng" : "Tồn kho & vị trí kệ"}</h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="Đóng danh sách">
            <IconX size={22} />
          </button>
        </div>
        <div className="drawer-tools">
          <input
            aria-label="Tìm trong danh sách"
            placeholder={mode === "shipments" ? "Tìm mã lô hàng, điểm đến…" : "Tìm mã SKU, sản phẩm, kệ…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {mode === "shipments" && (
            <button className="button" onClick={() => exportShipments(shipments)}>
              <IconDownload size={17} />
              Xuất CSV
            </button>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {(mode === "shipments"
                  ? ["Lô hàng", "Điểm đến", "Số pallet", "ETA", "Trạng thái", ""]
                  : ["Sản phẩm", "Mã SKU", "Kệ", "Tồn kho", "Trạng thái", ""]
                ).map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mode === "shipments"
                ? shipments.map((sh) => (
                    <tr key={sh.id}>
                      <td>
                        <strong>{sh.id}</strong>
                      </td>
                      <td>{sh.destination}</td>
                      <td>{sh.pallets}</td>
                      <td>{sh.eta}</td>
                      <td>
                        <Badge status={sh.status} />
                      </td>
                      <td>
                        {sh.truckId && (
                          <button
                            className="text-button"
                            onClick={() => {
                              s.select({ kind: "truck", id: sh.truckId! });
                              close();
                            }}
                          >
                            Xem xe <IconArrowRight size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                : items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <strong>{i.name}</strong>
                      </td>
                      <td>{i.sku}</td>
                      <td>{i.location}</td>
                      <td>{i.quantity} kiện</td>
                      <td>
                        <span className={`badge ${i.quantity < i.minimum ? "delayed" : "transit"}`}>
                          <i />
                          {i.quantity < i.minimum ? "Tồn kho thấp" : "Đủ hàng"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => {
                            s.select({ kind: "inventory", id: i.id });
                            if (s.roof) s.toggleRoof();
                            close();
                          }}
                        >
                          Xem kệ <IconArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {(mode === "shipments" ? shipments.length : items.length) === 0 && (
            <div className="empty-state">Không tìm thấy dữ liệu phù hợp.</div>
          )}
        </div>
        <div className="drawer-footer">
          {mode === "shipments" ? shipments.length : items.length} kết quả · Dữ liệu mô phỏng tại kho đang chọn
        </div>
      </section>
    </div>
  );
}
