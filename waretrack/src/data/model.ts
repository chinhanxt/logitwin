export type Position = [number, number, number];
export type VehicleStatus = 'en_route' | 'at_gate' | 'docking' | 'loading' | 'unloading' | 'departing' | 'in_transit' | 'delivered';
export type ForkliftStatus = 'idle' | 'fetching' | 'loading_truck' | 'unloading_truck' | 'charging';
export interface Site {
 id: string; code: string; name: string; city: string; address: string; area: string; accent: string;
 kind: 'depot' | 'distribution_center' | 'cold_store' | 'cross_dock' | 'automated_dc';
 capacity: number; initialStock: number; dockCount: number; onTime: number; outbound: number; putaways: number;
}
export interface Truck {
 id: string; siteId: string; name: string; plate: string; carrier: string; driver: string;
 status: VehicleStatus; dockId?: string; shipmentId: string; position: Position; color: string;
 previousPosition: Position; previousHeading: number; heading: number; gateSlot: number; speed: number; progress: number; elapsed: number; updatedAt: number; inbound: boolean; cycle: number; palletIds: string[];
}
export interface Dock { id: string; siteId: string; name: string; direction: 'in' | 'out'; position: Position }
export interface Forklift {
 id: string; siteId: string; name: string; driver: string; model: string; battery: number;
 position: Position; active: boolean; updatedAt: number; status: ForkliftStatus;
 path?: {position: Position;heading: number}[]; pathTarget?: string; waitTicks?: number; forkContact?: string;
 previousPosition: Position; previousHeading: number; heading: number; speed: number; taskPause: number; movesToday: number; chargerId?: string; truckId?: string; carrying?: string;
}
export interface InventoryItem {
 id: string; siteId: string; name: string; sku: string; quantity: number; minimum: number; location: string; position: Position;
}
export interface Pallet {
 id: string; siteId: string; name: string; sku: string; quantity: number; weightKg: number; lot: string;
 receivedAt: number; status: 'in_rack' | 'staged' | 'moving' | 'loaded'; location: string; position: Position; forkliftId?: string;
}
export interface Charger {
 id: string; siteId: string; name: string; position: Position; forkliftId?: string; sessions: number; energyKwh: number; rate: number;
}
export interface Shipment {
 id: string; siteId: string; truckId: string; customer: string; destination: string;
 pallets: number; weight: string; eta: string; status: VehicleStatus;
 steps: { key: 'confirmed' | 'picked' | 'loading' | 'in_transit' | 'delivered'; at?: number }[];
}
export type Selection = { kind: 'truck' | 'dock' | 'forklift' | 'inventory' | 'pallet' | 'charger' | 'site'; id: string };
export interface SimEvent { t: number; siteId: string; entityId: string; type: string }
export interface Simulation {
 seconds: number; randomSeed: number; tickCount: number; trucks: Truck[]; docks: Dock[]; forklifts: Forklift[];
 inventory: InventoryItem[]; pallets: Pallet[]; chargers: Charger[]; shipments: Shipment[]; events: SimEvent[];
}
export const statusLabel: Record<VehicleStatus, string> = {
 en_route: 'Đang đến', at_gate: 'Tại cổng', docking: 'Vào cửa', loading: 'Xếp hàng', unloading: 'Dỡ hàng',
 departing: 'Rời kho', in_transit: 'Đang giao', delivered: 'Đã giao',
};
export const forkliftLabel: Record<ForkliftStatus, string> = {
 idle: 'Sẵn sàng', fetching: 'Lấy pallet', loading_truck: 'Xếp hàng', unloading_truck: 'Dỡ hàng', charging: 'Đang sạc',
};
export const kindLabel: Record<Site['kind'], string> = {
 depot: 'KHO TRUNG CHUYỂN', distribution_center: 'TRUNG TÂM PHÂN PHỐI', cold_store: 'KHO LẠNH',
 cross_dock: 'KHO CROSS-DOCK', automated_dc: 'TRUNG TÂM TỰ ĐỘNG',
};
export const statusColor: Record<VehicleStatus, string> = {
 en_route: '#3b79f4', at_gate: '#c47b12', docking: '#3b79f4', loading: '#22a34b',
 unloading: '#22a34b', departing: '#3b79f4', in_transit: '#3b79f4', delivered: '#78859b',
};
