import type { Stock, Decision, Forecast, Event, Movement, Actor } from "../core/contracts";
import type { WorkflowSummary } from "../core/workflow";
export interface Overview {
  workflows?: WorkflowSummary[];
  telemetry: { id: number; store: string; temperature: number; source: string; created_at: string }[];
  stocks: Stock[];
  decisions: Decision[];
  forecasts: Forecast[];
  events: Event[];
  movements: Movement[];
  dataSource: string;
  now: string;
}
export interface Explanation {
  mode: string;
  sections: { title: string; body: string }[];
  evidence: { decisionId: string; stockVersion: number; method: string; createdAt: string };
}
export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: method === "GET" ? {} : { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body || {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Không thể kết nối lõi.");
  return data;
}
export type Session = Actor & { mode: string };
export const money = (n: number) => new Intl.NumberFormat("vi-VN").format(n);
export const storeName = (id: string) => ({ q1: "Quận 1", q3: "Quận 3", q7: "Quận 7" })[id] || id;
export const kindName = { transfer: "Điều chuyển", restock: "Nhập hàng", markdown: "Giảm giá" };
export const statusName = { pending: "Chờ duyệt", approved: "Đã duyệt", executed: "Đã thực thi", rejected: "Đã từ chối" };
