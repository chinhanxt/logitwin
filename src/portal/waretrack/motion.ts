import type { Movement } from "../../core/contracts.ts";
import type { Overview } from "../api.ts";
import type { Point } from "../twin/model.ts";

export interface VehiclePose {
  position: Point;
  yaw: number;
}
interface LineSegment {
  kind: "line";
  start: number;
  length: number;
  from: readonly [number, number];
  tangent: readonly [number, number];
}
interface ArcSegment {
  kind: "arc";
  start: number;
  length: number;
  center: readonly [number, number];
  angle: number;
  radius: number;
}
export interface ClosedLoop {
  readonly length: number;
  readonly segments: readonly (LineSegment | ArcSegment)[];
}

/** View coordinates only: no GPS, elapsed delivery time or workflow progress. */
export function roundedLoop(minX: number, maxX: number, minZ: number, maxZ: number, radius: number): ClosedLoop {
  if (![minX, maxX, minZ, maxZ, radius].every(Number.isFinite) || radius <= 0 || maxX <= minX || maxZ <= minZ)
    throw new RangeError("The visual route must have finite, increasing bounds and a positive radius.");
  if (radius > Math.min(maxX - minX, maxZ - minZ) / 2) throw new RangeError("The visual route radius exceeds its bounds.");
  const segments: (LineSegment | ArcSegment)[] = [];
  let length = 0;
  const line = (from: readonly [number, number], tangent: readonly [number, number], size: number) => {
    if (size > 0)
      segments.push({
        kind: "line",
        start: length,
        length: size,
        from,
        tangent,
      });
    length += size;
  };
  const arc = (center: readonly [number, number], angle: number) => {
    const size = (Math.PI * radius) / 2;
    segments.push({
      kind: "arc",
      start: length,
      length: size,
      center,
      angle,
      radius,
    });
    length += size;
  };
  const width = maxX - minX - radius * 2;
  const depth = maxZ - minZ - radius * 2;
  line([minX + radius, minZ], [1, 0], width);
  arc([maxX - radius, minZ + radius], -Math.PI / 2);
  line([maxX, minZ + radius], [0, 1], depth);
  arc([maxX - radius, maxZ - radius], 0);
  line([maxX - radius, maxZ], [-1, 0], width);
  arc([minX + radius, maxZ - radius], Math.PI / 2);
  line([minX, maxZ - radius], [0, -1], depth);
  arc([minX + radius, minZ + radius], Math.PI);
  return { length, segments };
}

export function sampleLoop(loop: ClosedLoop, distance: number): VehiclePose {
  const safeDistance = Number.isFinite(distance) ? distance : 0;
  const travelled = ((safeDistance % loop.length) + loop.length) % loop.length;
  const segment = loop.segments.find((part) => travelled < part.start + part.length) || loop.segments[0];
  const local = travelled - segment.start;
  if (segment.kind === "line") {
    const [dx, dz] = segment.tangent;
    return {
      position: [segment.from[0] + dx * local, 0.08, segment.from[1] + dz * local],
      yaw: Math.atan2(dx, dz),
    };
  }
  const angle = segment.angle + local / segment.radius;
  return {
    position: [segment.center[0] + Math.cos(angle) * segment.radius, 0.08, segment.center[1] + Math.sin(angle) * segment.radius],
    yaw: Math.atan2(-Math.sin(angle), Math.cos(angle)),
  };
}

/** A long background frame cannot teleport vehicles when the tab becomes visible. */
export function advanceVisualTime(current: number, delta: number, running: boolean, reducedMotion: boolean): number {
  const time = Number.isFinite(current) ? Math.max(0, current) : 0;
  if (!running || reducedMotion || !Number.isFinite(delta)) return time;
  return time + Math.min(Math.max(delta, 0), 0.1);
}

export const TRUCK_LOOP = roundedLoop(-18, 18, 12, 15.6, 1.75);
export const FORKLIFT_LOOPS = [roundedLoop(-8.3, -3.2, 8.1, 9.8, 0.65), roundedLoop(3.2, 8.3, 8.1, 9.8, 0.65)] as const;
export const DOCK_X = [-8.25, -4.95, -1.65, 1.65, 4.95, 8.25] as const;
export const TRUCK_SPEED = 2.5;
export const FORKLIFT_SPEED = 0.65;

function queuePose(index: number): VehiclePose {
  return {
    position: [13 + Math.floor(index / 3) * 3.5, 0.08, -7 + (index % 3) * 5.3],
    yaw: 0,
  };
}

export interface MovementVehicle {
  movement: Movement;
  moving: boolean;
  pose: VehiclePose;
  offset: number;
  color: string;
}

export function storeMovements(data: Pick<Overview, "stocks" | "movements">, storeId: string): Movement[] {
  const stocks = new Set(data.stocks.filter((stock) => stock.store === storeId).map((stock) => stock.id));
  return data.movements.filter(
    (movement) => movement.status !== "cancelled" && (stocks.has(movement.source) || (movement.target !== null && stocks.has(movement.target))),
  );
}

/** The only authority for moving vs parked is the server's movement status. */
export function movementVehicles(data: Pick<Overview, "stocks" | "movements">, storeId: string, limit = 10, selectedId?: string): MovementVehicle[] {
  const cap = Math.min(10, Math.max(0, Number.isFinite(limit) ? Math.floor(limit) : 10));
  const related = storeMovements(data, storeId)
    .sort(
      (a, b) =>
        Number(b.id === selectedId) - Number(a.id === selectedId) ||
        Number(b.status === "in_transit") - Number(a.status === "in_transit") ||
        a.id.localeCompare(b.id),
    )
    .slice(0, cap);
  let dock = 0;
  let queued = 0;
  return related.flatMap((movement, index) => {
    const moving = movement.status === "in_transit";
    const offset = (index * TRUCK_LOOP.length) / Math.max(related.length, 1);
    let pose: VehiclePose;
    if (moving) pose = sampleLoop(TRUCK_LOOP, offset);
    else if (movement.status === "ordered") {
      if (queued >= 6) return [];
      pose = queuePose(queued++);
    } else {
      const bay = dock++;
      // Six docks and a separate overflow queue avoid stacking parked symbols.
      if (bay >= DOCK_X.length && queued >= 6) return [];
      pose = bay < DOCK_X.length ? { position: [DOCK_X[bay], 0.08, 4.8], yaw: 0 } : queuePose(queued++);
    }
    return [
      {
        movement,
        moving,
        pose,
        offset,
        color: movement.status === "received" ? "#50ad8a" : movement.status === "reserved" ? "#d5a151" : "#3a85da",
      },
    ];
  });
}

export function forkliftActivity(data: Overview, storeId: string, presentation: boolean): { animate: boolean; movementId: string | null } {
  const active = storeMovements(data, storeId)
    .filter((movement) => ["reserved", "in_transit", "ordered"].includes(movement.status))
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    animate: active.length > 0 || presentation,
    movementId: active[0]?.id || null,
  };
}
