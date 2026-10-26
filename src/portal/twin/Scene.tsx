import { Canvas } from "@react-three/fiber";
import type { Overview } from "../api";
import type { Selection, StoreNode } from "./model";
import type { CameraCommand, TwinView } from "./camera";
import NetworkScene from "./NetworkScene";
import { CameraRig } from "../waretrack/CameraRig";
import { SiteGround } from "../waretrack/SiteGround";
import { WarehouseBuilding } from "../waretrack/WarehouseBuilding";
import { MovingVehicles } from "../waretrack/MovingVehicles";

export interface SceneProps {
  data: Overview;
  stores: StoreNode[];
  storeId: string;
  view: TwinView;
  roof: boolean;
  labels: boolean;
  running: boolean;
  reducedMotion: boolean;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
  command: CameraCommand;
}
export default function Scene(props: SceneProps) {
  const { data, stores, storeId, view, roof, labels, running, reducedMotion, selection, onSelect, command } = props;
  if (view === "network") return <NetworkScene {...props} />;
  const node = stores.find((store) => store.id === storeId) || stores[0];
  if (!node) return <div className="twin-fallback">Chưa có dòng tồn để dựng khuôn viên.</div>;
  return (
    <Canvas
      shadows
      orthographic
      frameloop={running && !reducedMotion ? "always" : "demand"}
      dpr={[1, 1.6]}
      camera={{ position: [32, 29, 37], zoom: 15, near: 0.1, far: 250 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={["#eef3f8"]} />
      <ambientLight intensity={1.4} />
      <hemisphereLight args={["#f1f6ff", "#a6b8ca", 1.1]} />
      <directionalLight
        position={[-16, 32, 18]}
        intensity={2.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={32}
        shadow-camera-bottom={-32}
        shadow-normalBias={0.04}
        shadow-bias={-0.0001}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.82, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#eef3f8" roughness={1} />
      </mesh>
      <SiteGround />
      <WarehouseBuilding node={node} roof={roof} labels={labels} selection={selection} onSelect={onSelect} movements={data.movements} />
      <MovingVehicles
        data={data}
        storeId={node.id}
        selection={selection}
        onSelect={onSelect}
        running={running}
        reducedMotion={reducedMotion}
        presentation
        labels={labels}
      />
      <CameraRig command={command} reducedMotion={reducedMotion} storeId={node.id} />
    </Canvas>
  );
}
