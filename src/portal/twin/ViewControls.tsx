import { IconBuildingWarehouse, IconHierarchy, IconPlayerPause, IconPlayerPlay, IconTag } from "@tabler/icons-react";
import { storeName } from "../api";
import type { StoreNode } from "./model";
import type { TwinView } from "./camera";

interface Props {
  stores: StoreNode[];
  storeId: string;
  view: TwinView;
  running: boolean;
  reducedMotion: boolean;
  labels: boolean;
  onView: (view: TwinView) => void;
  onStore: (id: string) => void;
  onRunning: () => void;
  onLabels: () => void;
}
export default function ViewControls(props: Props) {
  return (
    <div className="twin-view-controls">
      <div className="twin-view-switch" role="group" aria-label="Chế độ không gian 3D">
        <button aria-pressed={props.view === "warehouse"} onClick={() => props.onView("warehouse")}>
          <IconBuildingWarehouse size={17} />
          Kho chi tiết
        </button>
        <button aria-pressed={props.view === "network"} onClick={() => props.onView("network")}>
          <IconHierarchy size={17} />
          Mạng lưới
        </button>
      </div>
      {props.view === "warehouse" && (
        <select aria-label="Khuôn viên đang xem" value={props.storeId} onChange={(e) => props.onStore(e.target.value)}>
          {props.stores.map((node) => (
            <option key={node.id} value={node.id}>
              {storeName(node.id)}
            </option>
          ))}
        </select>
      )}
      <div className="twin-playback">
        <span className={props.running && !props.reducedMotion ? "moving" : ""}>
          {props.reducedMotion ? "Giảm chuyển động" : props.running ? "Đang chạy hình 3D" : "Đã dừng hình 3D"}
        </span>
        <button
          aria-label={props.running ? "Dừng chuyển động 3D" : "Chạy chuyển động 3D"}
          aria-pressed={!props.running}
          disabled={props.reducedMotion}
          onClick={props.onRunning}
        >
          {props.running ? <IconPlayerPause size={17} /> : <IconPlayerPlay size={17} />}
        </button>
        <button aria-label={props.labels ? "Ẩn nhãn mô hình" : "Hiện nhãn mô hình"} aria-pressed={props.labels} onClick={props.onLabels}>
          <IconTag size={17} />
        </button>
      </div>
    </div>
  );
}
