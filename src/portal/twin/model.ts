import type { Decision, Movement, Stock } from "../../core/contracts.ts";
import type { Overview } from "../api.ts";

export type Point = [number, number, number];
export type Selection = { kind: "store" | "stock" | "movement"; id: string };
export interface StoreNode {
  id: string;
  index: number;
  position: Point;
  stocks: Stock[];
  held: number;
  reserved: number;
  reading: Overview["telemetry"][number] | undefined;
}
export const movementLabels: Record<string, string> = {
  reserved: "Đã giữ hàng",
  in_transit: "Đã xuất phát",
  ordered: "Đã tạo đơn mua",
  received: "Đã nhận",
  cancelled: "Đã hủy",
};
export const movementColors: Record<string, string> = {
  reserved: "#d5a151",
  in_transit: "#3a85da",
  ordered: "#7e8cc6",
  received: "#50ad8a",
  cancelled: "#9ba8b9",
};
export function movementLabel(status: string): string {
  return movementLabels[status] || status;
}
export function storeLayout(index: number, count: number): Point {
  if (count <= 3)
    return (
      (
        [
          [-8, 0, -5],
          [8, 0, -5],
          [8, 0, 9],
        ] as Point[]
      )[index] || [0, 0, 0]
    );
  return [index % 2 === 0 ? -8 : 8, 0, Math.floor(index / 2) * 14 - (Math.ceil(count / 2) - 1) * 7];
}
export function deriveStores(data: Overview): StoreNode[] {
  const ids = [...new Set(data.stocks.map((s) => s.store))].sort();
  return ids.map((id, index) => {
    const stocks = data.stocks.filter((s) => s.store === id);
    const reading = data.telemetry.filter((t) => t.store === id).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)[0];
    return {
      id,
      index,
      position: storeLayout(index, ids.length),
      stocks,
      held: stocks.filter((s) => s.quality === "hold").length,
      reserved: stocks.filter((s) => s.reserved > 0).length,
      reading,
    };
  });
}
export function resolveSelection(data: Overview, selection: Selection | null): Selection | null {
  if (!selection) return null;
  const found =
    selection.kind === "stock"
      ? data.stocks.some((s) => s.id === selection.id)
      : selection.kind === "movement"
        ? data.movements.some((m) => m.id === selection.id)
        : data.stocks.some((s) => s.store === selection.id);
  return found ? selection : null;
}
export function stockForMovement(data: Overview, movement: Movement): Stock | undefined {
  return data.stocks.find((s) => s.id === movement.source);
}
export function relatedDecisions(data: Overview, selection: Selection | null): Decision[] {
  if (!selection) return [];
  if (selection.kind === "movement") {
    const movement = data.movements.find((m) => m.id === selection.id);
    return data.decisions.filter((d) => d.id === movement?.decision);
  }
  const ids = selection.kind === "stock" ? [selection.id] : data.stocks.filter((s) => s.store === selection.id).map((s) => s.id);
  return data.decisions.filter((d) => ids.includes(d.payload.source) || (d.payload.target && ids.includes(d.payload.target)));
}
export function relatedEvents(data: Overview, selection: Selection | null) {
  if (!selection) return data.events.slice(0, 5);
  const entities = new Set([selection.id]);
  for (const d of relatedDecisions(data, selection)) entities.add(d.id);
  if (selection.kind === "store") for (const s of data.stocks.filter((s) => s.store === selection.id)) entities.add(s.id);
  if (selection.kind === "movement") {
    const m = data.movements.find((m) => m.id === selection.id);
    if (m) {
      entities.add(m.decision);
      entities.add(m.source);
      if (m.target) entities.add(m.target);
    }
  }
  return data.events.filter((e) => entities.has(e.entity)).slice(0, 5);
}
export function operationCounts(data: Overview) {
  return {
    stockLines: data.stocks.length,
    forecastLines: data.forecasts.length,
    pending: data.decisions.filter((d) => d.status === "pending").length,
    approved: data.decisions.filter((d) => d.status === "approved").length,
    executed: data.decisions.filter((d) => d.status === "executed").length,
    reserved: data.movements.filter((m) => m.status === "reserved").length,
    travelling: data.movements.filter((m) => m.status === "in_transit").length,
    received: data.movements.filter((m) => m.status === "received").length,
    held: data.stocks.filter((s) => s.quality === "hold").length,
    events: data.events.length,
  };
}
