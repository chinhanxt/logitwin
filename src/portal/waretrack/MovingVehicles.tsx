import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Object3D } from "three";
import type { Overview } from "../api.ts";
import { movementLabel } from "../twin/model.ts";
import type { Selection } from "../twin/model.ts";
import { ForkliftGeometry, TruckGeometry } from "./VehicleGeometry.tsx";
import {
  advanceVisualTime,
  FORKLIFT_LOOPS,
  FORKLIFT_SPEED,
  forkliftActivity,
  movementVehicles,
  sampleLoop,
  TRUCK_LOOP,
  TRUCK_SPEED,
} from "./motion.ts";
import type { MovementVehicle } from "./motion.ts";

export interface MovingVehiclesProps {
  data: Overview;
  storeId: string;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
  running: boolean;
  reducedMotion: boolean;
  /** Explicitly illustrative forklift movement when no operation is active. */
  presentation?: boolean;
  limit?: number;
  labels?: boolean;
}

function useWheels(group: RefObject<Group | null>, selected: boolean): RefObject<Object3D[]> {
  const wheels = useRef<Object3D[]>([]);
  useEffect(() => {
    wheels.current = [];
    group.current?.traverse((object) => {
      if (object.name === "wheel") wheels.current.push(object);
    });
  }, [group, selected]);
  return wheels;
}

function MovingTruck({
  vehicle,
  selected,
  labels,
  onSelect,
  running,
  reducedMotion,
}: {
  vehicle: MovementVehicle;
  selected: boolean;
  labels: boolean;
  onSelect: MovingVehiclesProps["onSelect"];
  running: boolean;
  reducedMotion: boolean;
}) {
  const group = useRef<Group>(null);
  const elapsed = useRef(0);
  // Preserve the route phase across SSE refreshes and selection changes.
  const offset = useRef(vehicle.offset);
  const wheels = useWheels(group, selected);
  useFrame((_, delta) => {
    if (!group.current || !vehicle.moving) return;
    elapsed.current = advanceVisualTime(elapsed.current, delta, running, reducedMotion);
    const distance = elapsed.current * TRUCK_SPEED;
    const pose = sampleLoop(TRUCK_LOOP, offset.current + distance);
    group.current.position.set(...pose.position);
    group.current.rotation.y = pose.yaw;
    for (const wheel of wheels.current) wheel.rotation.x = distance / 0.34;
  });
  return (
    <group
      ref={group}
      name={`movement-vehicle:${vehicle.movement.id}`}
      position={vehicle.pose.position}
      rotation={[0, vehicle.pose.yaw, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect({ kind: "movement", id: vehicle.movement.id });
      }}
    >
      <TruckGeometry
        color={vehicle.color}
        selected={selected}
        label={
          labels ? `${vehicle.movement.kind === "restock" ? "NHẬP HÀNG" : "ĐIỀU CHUYỂN"} · ${movementLabel(vehicle.movement.status)}` : undefined
        }
      />
      {vehicle.movement.status === "received" && (
        <mesh position={[0, 3.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.22, 0.33, 24]} />
          <meshBasicMaterial color="#50ad8a" />
        </mesh>
      )}
    </group>
  );
}

function MovingForklift({
  index,
  storeId,
  movementId,
  animate,
  running,
  reducedMotion,
  onSelect,
  selected,
}: {
  index: 0 | 1;
  storeId: string;
  movementId: string | null;
  animate: boolean;
  running: boolean;
  reducedMotion: boolean;
  onSelect: MovingVehiclesProps["onSelect"];
  selected: boolean;
}) {
  const group = useRef<Group>(null);
  const elapsed = useRef(0);
  const loop = FORKLIFT_LOOPS[index];
  const initial = sampleLoop(loop, index * loop.length * 0.5);
  const wheels = useWheels(group, selected);
  useFrame((_, delta) => {
    if (!group.current || !animate) return;
    elapsed.current = advanceVisualTime(elapsed.current, delta, running, reducedMotion);
    const distance = elapsed.current * FORKLIFT_SPEED;
    const pose = sampleLoop(loop, index * loop.length * 0.5 + distance);
    group.current.position.set(...pose.position);
    group.current.rotation.y = pose.yaw;
    for (const wheel of wheels.current) wheel.rotation.x = distance / 0.24;
  });
  return (
    <group
      ref={group}
      name={`illustrative-forklift:${storeId}:${index}`}
      position={initial.position}
      rotation={[0, initial.yaw, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(movementId ? { kind: "movement", id: movementId } : { kind: "store", id: storeId });
      }}
    >
      <ForkliftGeometry selected={selected} lift={0.18 + index * 0.1} />
    </group>
  );
}

/** Presentation is deliberately read-only; workflow actions belong to the inspector. */
export function MovingVehicles({
  data,
  storeId,
  selection,
  onSelect,
  running,
  reducedMotion,
  presentation = false,
  limit = 10,
  labels = true,
}: MovingVehiclesProps) {
  const selectedId = selection?.kind === "movement" ? selection.id : undefined;
  const vehicles = useMemo(() => movementVehicles(data, storeId, limit, selectedId), [data, storeId, limit, selectedId]);
  const activity = useMemo(() => forkliftActivity(data, storeId, presentation), [data, storeId, presentation]);
  return (
    <group name="warehouse-visual-vehicles">
      {vehicles.map((vehicle) => (
        <MovingTruck
          key={vehicle.movement.id}
          vehicle={vehicle}
          labels={labels}
          selected={selection?.kind === "movement" && selection.id === vehicle.movement.id}
          onSelect={onSelect}
          running={running}
          reducedMotion={reducedMotion}
        />
      ))}
      {([0, 1] as const).map((index) => (
        <MovingForklift
          key={`${storeId}:${index}`}
          index={index}
          storeId={storeId}
          movementId={activity.movementId}
          animate={activity.animate}
          running={running}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
          selected={selection?.kind === "movement" && selection.id === activity.movementId}
        />
      ))}
    </group>
  );
}
