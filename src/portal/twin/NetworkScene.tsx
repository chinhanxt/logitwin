import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { SceneProps } from "./Scene";
import { Box, Label, Tree } from "./Primitives";
import StoreBuilding from "./StoreBuilding";
import NetworkMovements from "./NetworkMovements";

import type { CameraCommand } from "./camera";
function Camera({ command, center }: { command: CameraCommand; center: number }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const fit = Math.max(1, Math.min(2.6, (size.height / Math.max(1, size.width)) * 1.12));
  useEffect(() => {
    const target = controls.current?.target;
    if (!target) return;
    if (command.kind === "reset") {
      camera.position.set(27 * fit, 26 * fit, 34 * fit + center);
      target.set(0, 0, center);
    } else if (command.kind === "focus" && command.target) {
      const [x, y, z] = command.target;
      target.set(x, y, z);
      camera.position.set(x + 10 * fit, y + 11 * fit, z + 15 * fit);
    } else if (command.kind === "top") {
      camera.position.set(0.01, 48 * fit, center + 0.01);
      target.set(0, 0, center);
    } else {
      const offset = camera.position
        .clone()
        .sub(target)
        .multiplyScalar(command.kind === "in" ? 0.8 : 1.25);
      camera.position.copy(target.clone().add(offset));
    }
    camera.updateProjectionMatrix();
    controls.current?.update();
  }, [command, camera, center, fit]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={[0, 0, center]}
      minDistance={15}
      maxDistance={150}
      maxPolarAngle={Math.PI / 2.15}
      enableDamping
      dampingFactor={0.09}
    />
  );
}
function StreetFurniture({ center, depth, labels }: { center: number; depth: number; labels: boolean }) {
  return (
    <>
      <Box at={[0, -0.48, center]} size={[34, 0.75, depth]} color="#e2ebf4" />
      <Box at={[0, -0.04, center]} size={[33.8, 0.16, depth - 0.2]} color="#f3f7fa" />
      <Box at={[0, 0.08, center]} size={[4.8, 0.035, depth - 1]} color="#dbe5ee" />
      {[1, 15].map((z) => (
        <Box key={z} at={[0, 0.1, z]} size={[30.8, 0.03, 3.2]} color="#dbe5ee" />
      ))}
      {Array.from({ length: Math.ceil(depth / 2) }, (_, index) => center - depth / 2 + 1 + index * 2).map((z) => (
        <Box key={z} at={[0, 0.13, z]} size={[0.08, 0.015, 0.8]} color="#fdfefe" />
      ))}
      {[-15.5, 15.5].flatMap((x) => [-10, -2, 6, 14].map((z) => <Tree key={`${x}-${z}`} at={[x, 0.05, z]} />))}
      {[-12, 12].flatMap((x) =>
        [-10.5, 18].map((z) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <Box at={[0, 1.7, 0]} size={[0.1, 3.3, 0.1]} color="#b1c2d3" />
            <Box at={[0, 3.38, 0.15]} size={[0.75, 0.11, 0.65]} color="#e0eaf2" />
            <Box at={[0, 3.31, 0.15]} size={[0.55, 0.018, 0.4]} color="#fbfff6" />
          </group>
        )),
      )}
      <Box at={[-8, 0.11, 10.7]} size={[10, 0.03, 7]} color="#e4edf4" />
      <Box at={[-8, 0.15, 10.7]} size={[9.6, 0.035, 6.7]} color="#f8fafc" />
      {[-11.5, -9.2, -6.9, -4.6].map((x) => (
        <Box key={x} at={[x, 0.18, 10.5]} size={[0.06, 0.02, 5.2]} color="#c8d9e9" />
      ))}
      <group position={[-8, 0, 17.2]}>
        <Box at={[0, 0.4, 0]} size={[9, 0.7, 1.15]} color="#ebf2ed" />
        {[-3.5, -1.1, 1.1, 3.5].map((x) => (
          <Tree key={x} at={[x, 0.55, 0]} />
        ))}
      </group>
      {labels && (
        <Label
          text="ĐIỀU PHỐI LOGISTICS"
          sub="Sơ đồ cửa hàng · bố trí minh họa"
          at={[-8, 0.85, 11.2]}
          width={7}
          background="#f5f9fc"
          color="#7092b7"
        />
      )}
      <group position={[-3.7, 0.15, 4.8]}>
        <Box at={[0, 0.15, 0]} size={[0.8, 0.3, 1.25]} color="#b0c4d7" />
        <Box at={[0, 0.43, -0.15]} size={[0.8, 0.25, 0.65]} color="#e4bd77" />
        <Box at={[0, 0.82, -0.36]} size={[0.85, 0.07, 0.7]} color="#c2d1e0" />
        {[-0.34, 0.34].map((x) => (
          <Box key={x} at={[x, 0.65, -0.6]} size={[0.04, 0.9, 0.05]} color="#92aac1" />
        ))}
      </group>
    </>
  );
}
export default function Scene({ data, stores, roof, selection, onSelect, command, running, reducedMotion, labels }: SceneProps) {
  const center = stores.length <= 3 ? 3.2 : 0;
  const depth = Math.max(33, Math.ceil(stores.length / 2) * 14 + 9);
  return (
    <Canvas
      shadows
      frameloop={running && !reducedMotion && data.movements.some((m) => m.status === "in_transit") ? "always" : "demand"}
      dpr={[1, 1.6]}
      camera={{ position: [27, 26, 37], fov: 40, near: 0.1, far: 220 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={["#f5f9fc"]} />
      <ambientLight intensity={0.85} />
      <hemisphereLight intensity={0.7} color="#ffffff" groundColor="#bbcddd" />
      <directionalLight
        position={[-14, 30, 18]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
        shadow-normalBias={0.035}
        shadow-bias={-0.0001}
      />
      <StreetFurniture center={center} depth={depth} labels={labels} />
      {stores.map((node) => (
        <StoreBuilding key={node.id} node={node} roof={roof} labels={labels} selection={selection} onSelect={onSelect} />
      ))}
      <NetworkMovements
        data={data}
        stores={stores}
        selection={selection}
        onSelect={onSelect}
        running={running}
        reducedMotion={reducedMotion}
        labels={labels}
      />
      <Camera command={command} center={center} />
    </Canvas>
  );
}
