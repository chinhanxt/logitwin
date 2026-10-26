import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  IconArrowRight,
  IconBox,
  IconBuildingWarehouse,
  IconCube,
  IconFocus2,
  IconLayersIntersect,
  IconMinus,
  IconMaximize,
  IconPlus,
  IconRotate,
  IconTruck,
} from "@tabler/icons-react";
import type { Decision, Role } from "../../core/contracts";
import type { Overview } from "../api";
import { storeName } from "../api";
import { deriveStores, movementLabel, operationCounts, resolveSelection, stockForMovement } from "./model";
import type { Selection } from "./model";
const Scene = lazy(() => import("./Scene"));
import type { CameraCommand, TwinView } from "./camera";
import Inspector from "./Inspector";
import ViewControls from "./ViewControls";
import { useMotionPreferences } from "./useMotionPreferences";
import { movementVehicles } from "../waretrack/motion";
import "./twin.css";

export interface OperationalTwinProps {
  data: Overview;
  role: Role;
  busy: boolean;
  onDecision: (decision: Decision) => void;
  onAction: (path: string, message: string, body?: unknown) => Promise<void>;
}
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function availableWebGL() {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
export default function OperationalTwin({ data, role, busy, onDecision, onAction }: OperationalTwinProps) {
  const stage = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [roof, setRoof] = useState(true);
  const [view, setView] = useState<TwinView>("warehouse");
  const [storeId, setStoreId] = useState(data.stocks[0]?.store || "");
  const [running, setRunning] = useState(true);
  const [labels, setLabels] = useState(true);
  const { reducedMotion, visible } = useMotionPreferences();
  const [list, setList] = useState<"stores" | "movements">("stores");
  const [command, setCommand] = useState<CameraCommand>({ kind: "reset", nonce: 0 });
  const [webgl] = useState(availableWebGL);
  const stores = useMemo(() => deriveStores(data), [data]);
  const counts = useMemo(() => operationCounts(data), [data]);
  useEffect(() => setSelection((current) => resolveSelection(data, current)), [data]);
  useEffect(() => {
    if (!stores.some((node) => node.id === storeId)) setStoreId(stores[0]?.id || "");
  }, [stores, storeId]);
  function choose(next: Selection | null) {
    setSelection(next);
    if (next?.kind === "stock") setRoof(false);
    const stock = next?.kind === "stock" ? data.stocks.find((s) => s.id === next.id) : undefined;
    const movement = next?.kind === "movement" ? data.movements.find((m) => m.id === next.id) : undefined;
    const movementStock = movement
      ? data.stocks.find((s) => s.id === (movement.status === "received" && movement.target ? movement.target : movement.source))
      : undefined;
    const id = next?.kind === "store" ? next.id : stock?.store || movementStock?.store;
    if (id && id !== storeId) {
      setStoreId(id);
      setCommand((c) => ({ kind: "reset", nonce: c.nonce + 1 }));
    }
  }
  const focusedStore =
    selection?.kind === "store"
      ? stores.find((s) => s.id === selection.id)
      : selection?.kind === "stock"
        ? stores.find((s) => s.stocks.some((stock) => stock.id === selection.id))
        : selection?.kind === "movement"
          ? stores.find((s) => s.id === storeId)
          : undefined;
  const focusTarget = (() => {
    if (!focusedStore) return undefined;
    if (view === "network") return focusedStore.position;
    if (selection?.kind === "stock") {
      const index = Math.min(
        11,
        focusedStore.stocks.findIndex((stock) => stock.id === selection.id),
      );
      return [-7.5 + (index % 5) * 3.5, 0, -6 + Math.floor(index / 5) * 2.4] as [number, number, number];
    }
    if (selection?.kind === "movement")
      return movementVehicles(data, storeId, 10, selection.id).find((vehicle) => vehicle.movement.id === selection.id)?.pose.position;
    return [0, 0, -4] as [number, number, number];
  })();
  const selectionValue = selection ? `${selection.kind}:${selection.id}` : "";
  const fallback = (
    <div className="twin-fallback">
      <IconCube size={45} />
      <h3>Chế độ vận hành dạng bảng</h3>
      <p>Thiết bị chưa hiển thị được WebGL 3D. Chọn đối tượng trong danh sách để xem dữ liệu và thao tác.</p>
      <div>
        {stores.map((node) => (
          <button key={node.id} className="button secondary" onClick={() => choose({ kind: "store", id: node.id })}>
            <IconBuildingWarehouse size={19} />
            {storeName(node.id)}
          </button>
        ))}
      </div>
    </div>
  );
  const stages = [
    { label: "Dữ liệu", value: counts.stockLines, suffix: "dòng tồn", detail: "OLTP · tồn kho" },
    { label: "Phân tích", value: counts.forecastLines, suffix: "dự báo", detail: "Intelligence · số liệu" },
    { label: "Phê duyệt", value: counts.pending, suffix: "chờ duyệt", detail: `${counts.approved} đã duyệt` },
    { label: "Thực thi", value: counts.executed, suffix: "quyết định", detail: "Workflow · lõi số" },
    { label: "Vận chuyển", value: counts.travelling, suffix: "đã xuất phát", detail: `${counts.reserved} lệnh giữ hàng` },
    { label: "Đối chiếu", value: counts.received, suffix: "đã nhận", detail: `${counts.events} sự kiện gần nhất` },
  ];
  return (
    <section className="operational-twin" aria-label="Không gian 3D vận hành logistics">
      <div className="twin-summary">
        <div>
          <span className="eyebrow">OPERATIONAL TWIN / LOGISTICS</span>
          <h2>Mọi chuyển động, trong tầm mắt.</h2>
          <p>Từ dòng tồn và quyết định đến lệnh chuyển, nhận hàng và dấu vết thực thi.</p>
        </div>
        <div className="twin-summary-stats">
          <span>
            <b>{stores.length}</b>Cửa hàng
          </span>
          <span>
            <b>{counts.stockLines}</b>Dòng tồn
          </span>
          <span className={counts.held ? "hold" : ""}>
            <b>{counts.held}</b>Dòng cách ly
          </span>
        </div>
      </div>
      <div className="twin-layout">
        <div className="twin-left">
          <ViewControls
            stores={stores}
            storeId={storeId}
            view={view}
            running={running}
            reducedMotion={reducedMotion}
            labels={labels}
            onView={(next) => {
              setView(next);
              setCommand((c) => ({ kind: "reset", nonce: c.nonce + 1 }));
            }}
            onStore={(id) => choose({ kind: "store", id })}
            onRunning={() => setRunning((r) => !r)}
            onLabels={() => setLabels((l) => !l)}
          />
          <div
            className="twin-stage"
            ref={stage}
            data-view={view}
            data-motion={reducedMotion ? "reduced" : running && visible ? "running" : "paused"}
          >
            <div className="twin-stage-caption">
              <span className="twin-api-dot" />
              TRẠNG THÁI API<span>{view === "warehouse" ? `${storeName(storeId)} · khuôn viên minh họa` : "Liên kết giữa các cửa hàng"}</span>
            </div>
            <SceneBoundary fallback={fallback}>
              {webgl ? (
                <Suspense fallback={<div className="twin-fallback">Đang tải mô hình 3D…</div>}>
                  <Scene
                    data={data}
                    stores={stores}
                    storeId={storeId}
                    view={view}
                    roof={roof}
                    labels={labels}
                    running={running && visible}
                    reducedMotion={reducedMotion}
                    selection={selection}
                    onSelect={choose}
                    command={command}
                  />
                </Suspense>
              ) : (
                fallback
              )}
            </SceneBoundary>
            <div className="twin-tools" aria-label="Điều khiển góc nhìn 3D">
              <button aria-label={roof ? "Mở mái để xem kệ" : "Đóng mái kho"} aria-pressed={roof} onClick={() => setRoof(!roof)}>
                <IconLayersIntersect size={18} />
                <span>{roof ? "Mở mái" : "Đóng mái"}</span>
              </button>
              <button
                aria-label="Xem gần đối tượng"
                disabled={!focusTarget}
                onClick={() =>
                  setCommand((c) => ({
                    kind: "focus",
                    nonce: c.nonce + 1,
                    target: focusTarget,
                    objectName: view === "warehouse" && selection?.kind === "movement" ? `movement-vehicle:${selection.id}` : undefined,
                  }))
                }
              >
                <IconFocus2 size={18} />
              </button>
              <button
                aria-label="Toàn màn hình 3D"
                disabled={!document.fullscreenEnabled}
                onClick={() => {
                  void stage.current?.requestFullscreen().catch(() => {});
                }}
              >
                <IconMaximize size={18} />
              </button>
              <button aria-label="Góc nhìn từ trên" onClick={() => setCommand((c) => ({ kind: "top", nonce: c.nonce + 1 }))}>
                <IconFocus2 size={18} />
              </button>
              <button aria-label="Khôi phục góc nhìn 3D" onClick={() => setCommand((c) => ({ kind: "reset", nonce: c.nonce + 1 }))}>
                <IconRotate size={18} />
              </button>
              <i />
              <button aria-label="Phóng to mô hình" onClick={() => setCommand((c) => ({ kind: "in", nonce: c.nonce + 1 }))}>
                <IconPlus size={18} />
              </button>
              <button aria-label="Thu nhỏ mô hình" onClick={() => setCommand((c) => ({ kind: "out", nonce: c.nonce + 1 }))}>
                <IconMinus size={18} />
              </button>
            </div>
            <div className="twin-stage-foot">
              <span>Kéo: xoay · cuộn: thu/phóng · chuột phải: di chuyển</span>
              <b>{view === "warehouse" ? "Xe nâng: chuyển động minh họa" : "Xe tải: trạng thái lệnh API"}</b>
            </div>
          </div>
          <div className="twin-selector">
            <label htmlFor="twin-object-selector">
              <IconCube size={17} />
              Chọn đối tượng
            </label>
            <select
              id="twin-object-selector"
              value={selectionValue}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) return choose(null);
                const split = value.indexOf(":");
                choose({ kind: value.slice(0, split) as Selection["kind"], id: value.slice(split + 1) });
              }}
            >
              <option value="">Chọn cửa hàng, dòng tồn hoặc lệnh</option>
              <optgroup label="Cửa hàng">
                {stores.map((node) => (
                  <option key={node.id} value={`store:${node.id}`}>
                    {storeName(node.id)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Dòng tồn">
                {data.stocks.map((stock) => (
                  <option key={stock.id} value={`stock:${stock.id}`}>
                    {storeName(stock.store)} · {stock.name} · {stock.id}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Lệnh vận chuyển">
                {data.movements.map((m) => (
                  <option key={m.id} value={`movement:${m.id}`}>
                    {m.id.slice(0, 8)} · {movementLabel(m.status)}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="twin-bottom-list">
            <div className="twin-tabs" role="tablist" aria-label="Danh sách đối tượng">
              <button
                role="tab"
                aria-selected={list === "stores"}
                aria-controls="twin-object-list"
                id="twin-stores-tab"
                className={list === "stores" ? "active" : ""}
                onClick={() => setList("stores")}
              >
                <IconBuildingWarehouse size={17} />
                Cửa hàng <b>{stores.length}</b>
              </button>
              <button
                role="tab"
                aria-selected={list === "movements"}
                aria-controls="twin-object-list"
                id="twin-movements-tab"
                className={list === "movements" ? "active" : ""}
                onClick={() => setList("movements")}
              >
                <IconTruck size={17} />
                Lệnh vận chuyển <b>{data.movements.length}</b>
              </button>
            </div>
            <div id="twin-object-list" role="tabpanel" aria-labelledby={`twin-${list}-tab`} className={`twin-list ${list}`}>
              {list === "stores" ? (
                stores.map((node) => (
                  <button
                    key={node.id}
                    className={selection?.kind === "store" && selection.id === node.id ? "selected" : ""}
                    onClick={() => choose({ kind: "store", id: node.id })}
                  >
                    <span className={`twin-building-icon ${node.held ? "hold" : ""}`}>
                      <IconBuildingWarehouse size={24} />
                    </span>
                    <div>
                      <strong>{storeName(node.id)}</strong>
                      <small>
                        {node.stocks.length} dòng tồn · {node.reserved} dòng giữ hàng
                      </small>
                    </div>
                    <span className="twin-store-temperature">{node.reading ? `${node.reading.temperature / 100}°C · mẫu` : "Chưa có bản đọc"}</span>
                  </button>
                ))
              ) : data.movements.length ? (
                data.movements.map((m) => {
                  const source = stockForMovement(data, m),
                    target = data.stocks.find((s) => s.id === m.target);
                  return (
                    <button
                      key={m.id}
                      className={selection?.kind === "movement" && selection.id === m.id ? "selected" : ""}
                      onClick={() => choose({ kind: "movement", id: m.id })}
                    >
                      <span className={`twin-building-icon ${m.status}`}>
                        <IconTruck size={23} />
                      </span>
                      <div>
                        <strong>{source?.name || m.source}</strong>
                        <small>
                          {storeName(source?.store || m.source)} {target ? `→ ${storeName(target.store)}` : "· Đơn mua"} · {m.quantity}{" "}
                          {source?.unit || "đơn vị"}
                        </small>
                      </div>
                      <span className={`twin-status ${m.status}`}>{movementLabel(m.status)}</span>
                    </button>
                  );
                })
              ) : (
                <p className="twin-list-empty">
                  <IconBox size={22} />
                  Chưa có lệnh chuyển. Thực thi một đề xuất đã được duyệt để tạo lệnh.
                </p>
              )}
            </div>
          </div>
        </div>
        <Inspector
          data={data}
          stores={stores}
          selection={selection}
          role={role}
          busy={busy}
          onSelect={choose}
          onDecision={onDecision}
          onAction={onAction}
        />
      </div>
      <div className="twin-flow" aria-label="Các bước vận hành từ dữ liệu thực tế">
        {stages.map((stage, index) => (
          <div className="twin-flow-step" key={stage.label}>
            <div className="twin-flow-number">{String(index + 1).padStart(2, "0")}</div>
            <div>
              <span>{stage.label}</span>
              <strong>
                {stage.value} <small>{stage.suffix}</small>
              </strong>
              <p>{stage.detail}</p>
            </div>
            {index < stages.length - 1 && <IconArrowRight size={17} />}
          </div>
        ))}
      </div>
      <p className="twin-disclosure">
        Nguồn: {data.dataSource} · Kệ, đường nối và xe minh họa cấu trúc vận hành; không quy đổi mỗi kiện hình học thành một đơn vị hàng và không mô
        phỏng vị trí GPS. Chuyển động không thay đổi tồn kho hoặc workflow; các thao tác hợp lệ được xử lý bởi lõi số. Hình 3D hiển thị tối đa 12 dòng
        tồn mỗi cửa hàng và
        {view === "warehouse" ? " 10 lệnh tại khuôn viên" : " 8 lệnh trong mạng lưới"}; bảng chọn giữ đủ dữ liệu. Cửa xuất nhập và đường chạy là bố
        trí minh họa.
      </p>
    </section>
  );
}
