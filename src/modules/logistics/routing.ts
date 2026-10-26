import type { Actor, Stock } from "../../core/contracts.ts";
import { DomainError } from "../../core/contracts.ts";
import { Repository } from "../../core/database.ts";
import { assertAllocations, assertLotBalance } from "./lots.ts";
export interface RouteOptions {
  capacityKg: number;
  maxMinutes: number;
  speedKph: number;
}
export interface RouteStop {
  store: string;
  action: "pickup" | "dropoff";
  movement: string;
  quantity: number;
  weightKg: number;
  minute: number;
  loadKg: number;
}
export interface RoutePlan {
  method: string;
  stops: RouteStop[];
  unassigned: { movement: string; reason: string }[];
  distanceKm: number;
  minutes: number;
  assumptions: string[];
}
const weights: Record<string, number> = { salad: 0.25, milk: 0.5, berry: 0.3 };
export function distance(a: Pick<Stock, "lat" | "lng">, b: Pick<Stock, "lat" | "lng">) {
  const radians = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(radians(b.lat - a.lat) / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(radians(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h))) * 1.4;
}
export function planRoutes(repo: Repository, actor: Actor, options: RouteOptions): RoutePlan {
  if (
    ![options.capacityKg, options.maxMinutes, options.speedKph].every((n) => Number.isFinite(n)) ||
    options.capacityKg < 1 ||
    options.capacityKg > 1000 ||
    options.maxMinutes < 10 ||
    options.maxMinutes > 480 ||
    options.speedKph < 5 ||
    options.speedKph > 60
  )
    throw new DomainError(422, "Sức chứa 1–1000 kg, thời gian 10–480 phút, vận tốc 5–60 km/h.");
  const stocks = repo.stocks(actor.tenant);
  const origin = stocks.find((s) => s.store === "q1");
  if (!origin) throw new DomainError(422, "Chưa có điểm xuất phát.");
  let location = origin,
    time = 0,
    km = 0;
  const jobs = repo.db.prepare("SELECT * FROM movements WHERE tenant=? AND kind='transfer' AND status='reserved'").all(actor.tenant);
  const stops: RouteStop[] = [],
    unassigned: RoutePlan["unassigned"] = [];
  const remaining = [...jobs];
  while (remaining.length) {
    remaining.sort((a, b) => {
      const sa = stocks.find((s) => s.id === a.source),
        sb = stocks.find((s) => s.id === b.source);
      return (sa ? distance(location, sa) : Infinity) - (sb ? distance(location, sb) : Infinity);
    });
    const job = remaining.shift()!,
      source = stocks.find((s) => s.id === job.source),
      target = stocks.find((s) => s.id === job.target);
    const reject = (reason: string) => unassigned.push({ movement: String(job.id), reason });
    if (!source || !target) {
      reject("Thiếu địa điểm nguồn hoặc đích.");
      continue;
    }
    if (source.quality === "hold" || target.quality === "hold") {
      reject("Nguồn/đích đang bị cách ly.");
      continue;
    }
    const quantity = Number(job.quantity);
    if (
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      source.product !== target.product ||
      source.unit !== target.unit ||
      source.store === target.store
    ) {
      reject("Số lượng, sản phẩm hoặc đơn vị của lệnh không hợp lệ.");
      continue;
    }
    try {
      assertLotBalance(repo, actor.tenant, source.id);
      assertAllocations(repo, actor.tenant, String(job.id), quantity, source.id, true);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      reject(error.message);
      continue;
    }
    const weight = Math.round(quantity * (weights[source.product] || 1) * 100) / 100;
    if (weight > options.capacityKg) {
      reject(`Khối lượng ${weight} kg vượt sức chứa xe.`);
      continue;
    }
    const pickupKm = distance(location, source),
      deliveryKm = distance(source, target),
      finish = time + ((pickupKm + deliveryKm) / options.speedKph) * 60 + 10;
    if (finish > options.maxMinutes) {
      reject("Vượt thời gian tối đa của chuyến.");
      continue;
    }
    time += (pickupKm / options.speedKph) * 60 + 5;
    stops.push({
      store: source.store,
      action: "pickup",
      movement: String(job.id),
      quantity,
      weightKg: weight,
      minute: Math.round(time),
      loadKg: weight,
    });
    time += (deliveryKm / options.speedKph) * 60 + 5;
    stops.push({
      store: target.store,
      action: "dropoff",
      movement: String(job.id),
      quantity,
      weightKg: weight,
      minute: Math.round(time),
      loadKg: 0,
    });
    km += pickupKm + deliveryKm;
    location = target;
  }
  return {
    method: "Greedy pickup–delivery · baseline",
    stops,
    unassigned,
    distanceKm: Math.round(km * 10) / 10,
    minutes: Math.round(time),
    assumptions: [
      "Xuất phát từ Quận 1; một xe giao lần lượt từng lệnh.",
      "Khoảng cách Haversine × 1,4; vận tốc và trọng lượng sản phẩm là giả định mẫu.",
      "Phục vụ mỗi điểm 5 phút; chưa có dữ liệu đường, giao thông hoặc tủ lạnh.",
      "Xe được giả định đạt chuỗi lạnh; chưa có telemetry xác nhận.",
      "Đây là bản xem trước; không tự điều xe, chưa tích hợp PACO.",
    ],
  };
}
