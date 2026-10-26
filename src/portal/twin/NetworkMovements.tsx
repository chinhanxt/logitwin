import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { CatmullRomCurve3, Group, Vector3 } from "three";
import type { Overview } from "../api";
import type { Movement } from "../../core/contracts";
import type { Point, Selection, StoreNode } from "./model";
import { movementColors, movementLabel, stockForMovement } from "./model";
import { Box, Label } from "./Primitives";
import { TruckGeometry } from "../waretrack/VehicleGeometry";
import { advanceVisualTime } from "../waretrack/motion";

function routeCurve(points: Point[]) {
  const unique = points.filter((point, index) => !index || point.some((value, axis) => value !== points[index - 1][axis]));
  // A return lane closes the illustrative path without teleporting a symbol to its source.
  const forward = unique.map(([x, y, z]) => new Vector3(x + 0.38, y, z + 0.38));
  const backward = unique.toReversed().map(([x, y, z]) => new Vector3(x - 0.38, y, z - 0.38));
  return new CatmullRomCurve3([...forward, ...backward], true, "centripetal");
}

function Vehicle({
  movement,
  points,
  symbol,
  selected,
  labels,
  running,
  reducedMotion,
  onSelect,
}: {
  movement: Movement;
  points: Point[];
  symbol: Point;
  selected: boolean;
  labels: boolean;
  running: boolean;
  reducedMotion: boolean;
  onSelect: (selection: Selection) => void;
}) {
  const ref = useRef<Group>(null);
  const elapsed = useRef(0);
  const tangent = useRef(new Vector3());
  const point = useRef(new Vector3());
  const curve = useMemo(() => routeCurve(points), [points]);
  const color = movementColors[movement.status];
  useFrame((_, delta) => {
    if (!ref.current || movement.status !== "in_transit") return;
    elapsed.current = advanceVisualTime(elapsed.current, delta, running, reducedMotion);
    const phase = (elapsed.current / 28) % 1;
    curve.getPointAt(phase, point.current);
    curve.getTangentAt(phase, tangent.current);
    ref.current.position.copy(point.current);
    ref.current.rotation.y = Math.atan2(tangent.current.x, tangent.current.z);
  });
  return (
    <group
      ref={ref}
      name={`network-movement:${movement.id}`}
      position={symbol}
      onClick={(event) => {
        event.stopPropagation();
        onSelect({ kind: "movement", id: movement.id });
      }}
    >
      {movement.status === "received" ? (
        <Box at={[0, 0, 0]} size={[0.8, 0.65, 0.8]} color={color} />
      ) : (
        <group scale={0.55}>
          <TruckGeometry color={color} selected={selected} />
        </group>
      )}
      {selected && labels && (
        <Label text={movementLabel(movement.status)} sub={`${movement.quantity} · trạng thái lệnh`} at={[0, 3.1, 0]} width={5.8} color={color} />
      )}
    </group>
  );
}

export default function NetworkMovements({
  data,
  stores,
  selection,
  onSelect,
  running,
  reducedMotion,
  labels,
}: {
  data: Overview;
  stores: StoreNode[];
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
  running: boolean;
  reducedMotion: boolean;
  labels: boolean;
}) {
  const displayed = [...data.movements]
    .filter((movement) => movement.status !== "cancelled")
    .sort((a, b) => {
      const rank = (movement: Movement) =>
        selection?.kind === "movement" && selection.id === movement.id ? -1 : movement.status === "received" ? 2 : 0;
      return rank(a) - rank(b);
    })
    .slice(0, 8);
  return (
    <>
      {displayed.map((movement, index) => {
        const stock = stockForMovement(data, movement);
        const from = stores.find((store) => store.id === stock?.store);
        const targetStock = data.stocks.find((s) => s.id === movement.target);
        const to = stores.find((store) => store.id === targetStock?.store);
        if (!from) return null;
        const selected = selection?.kind === "movement" && selection.id === movement.id;
        const color = movementColors[movement.status];
        const origin: Point = [from.position[0], 0.24, from.position[2] + 5.25];
        const destination: Point = to ? [to.position[0], 0.24, to.position[2] + 5.25] : origin;
        const points: Point[] = [origin, [0, 0.24, origin[2]], [0, 0.24, destination[2]], destination];
        const symbol: Point =
          movement.status === "received" && to
            ? [to.position[0] - 3.2, 0.4, to.position[2] + 4.7]
            : [from.position[0] + ((index % 3) - 1) * 2.6, 0.24, from.position[2] + 5.4];
        return (
          <group key={movement.id}>
            {movement.kind === "transfer" && (
              <Line
                points={points}
                color={color}
                lineWidth={selected ? 3.5 : 1.8}
                dashed={movement.status === "reserved"}
                dashSize={0.5}
                gapSize={0.4}
                transparent
                opacity={selected ? 1 : 0.55}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect({ kind: "movement", id: movement.id });
                }}
              />
            )}
            <Vehicle
              movement={movement}
              points={points}
              symbol={symbol}
              selected={selected}
              labels={labels}
              running={running}
              reducedMotion={reducedMotion}
              onSelect={onSelect}
            />
          </group>
        );
      })}
    </>
  );
}
