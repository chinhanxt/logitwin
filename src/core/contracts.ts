export type Role = "planner" | "approver" | "viewer";
export interface Actor {
  id: string;
  tenant: string;
  role: Role;
}
export interface Stock {
  quality: "clear" | "hold";
  id: string;
  tenant: string;
  store: string;
  product: string;
  name: string;
  unit: string;
  on_hand: number;
  reserved: number;
  price: number;
  expires: string;
  version: number;
  history: number[];
  lat: number;
  lng: number;
  lots?: StockLot[];
}
export interface Forecast {
  stockId: string;
  daily: number;
  low: number;
  high: number;
  available: number;
  cover: number;
  method: string;
  sampleDays: number;
}
export type DecisionKind = "transfer" | "restock" | "markdown";
export interface DecisionPayload {
  source: string;
  target?: string;
  quantity: number;
  sourceVersion: number;
  targetVersion?: number;
  unitPrice?: number;
  forecast: Forecast;
  reason: string;
  assumptions: string[];
}
export interface Decision {
  id: string;
  tenant: string;
  kind: DecisionKind;
  status: "pending" | "approved" | "executed" | "rejected";
  payload: DecisionPayload;
  created_by: string;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface Event {
  seq: number;
  tenant: string;
  type: string;
  actor: string;
  entity: string;
  detail: string;
  created_at: string;
  previous_hash: string;
  hash: string;
}
export type MovementStatus = "reserved" | "in_transit" | "ordered" | "received" | "cancelled";
export interface StockLot {
  id: string;
  tenant: string;
  stock: string;
  batch_id: string;
  origin_stock: string;
  origin_batch: string;
  expires: string;
  on_hand: number;
  reserved: number;
  received_from: string | null;
}
export interface MovementLot {
  tenant: string;
  movement: string;
  source_lot: string;
  batch_id: string;
  origin_stock: string;
  origin_batch: string;
  expires: string;
  quantity: number;
  target_lot: string | null;
}
export interface PurchaseReceipt {
  batchId: string;
  expires: string;
  quantity: number;
}
export interface Movement {
  id: string;
  tenant: string;
  decision: string;
  kind: "transfer" | "restock";
  source: string;
  target: string | null;
  quantity: number;
  status: MovementStatus;
  created_at: string | null;
  dispatched_at: string | null;
  received_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  receipt: PurchaseReceipt | null;
  lots: MovementLot[];
}
export interface Document {
  id: string;
  title: string;
  body: string;
  classification: string;
  version: number;
  created_at: string;
}
export class DomainError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
