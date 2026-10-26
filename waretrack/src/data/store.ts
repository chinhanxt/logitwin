import { create } from 'zustand';
import { createSeed, sites } from './seed';
import type { Simulation, Selection, Truck, VehicleStatus } from './model';
import { isAtSite, isDocked, stepSimulation } from '../sim/engine';
export type CameraAction = 'reset' | 'in' | 'out' | 'top' | 'left' | 'right' | 'focus';
interface WarehouseState extends Simulation {
 siteId: string; selection: Selection | null; trackedTruckId: string; hovered: Selection | null;
 running: boolean; roof: boolean; labels: boolean; quality: 'auto' | 'low'; speed: number;
 filter: 'all' | VehicleStatus; search: string;
 cameraCommand: { action: CameraAction; nonce: number };
 select: (selection: Selection | null) => void; hover: (selection: Selection | null) => void;
 setSite: (id: string) => void; setSearch: (search: string) => void; setFilter: (filter: WarehouseState['filter']) => void;
 toggleRunning: () => void; toggleRoof: () => void; toggleLabels: () => void;
 setSpeed: (speed: number) => void; setQuality: (quality: WarehouseState['quality']) => void;
 camera: (action: CameraAction) => void; tick: () => void;
}
export const useWarehouse = create<WarehouseState>((set) => ({
 ...createSeed(), siteId: 'sgn', selection: { kind: 'site', id: 'sgn' }, trackedTruckId: 'sgn-t1', hovered: null,
 running: true, roof: true, labels: false, quality: 'auto', speed: 12, filter: 'all', search: '',
 cameraCommand: { action: 'reset', nonce: 0 },
 select: selection => set(s => {
  if (!selection) return { selection: null };
  const entity = findEntity(s, selection);
  if (!entity) return s;
  const siteId = 'siteId' in entity ? entity.siteId : entity.id;
  return { siteId, selection, search: '', filter: 'all', hovered: null,
   ...(selection.kind === 'truck' ? { trackedTruckId: selection.id } : siteId !== s.siteId ? { trackedTruckId: siteId + '-t1' } : {}),
   ...(selection.kind === 'inventory' ? { roof: false } : {}),
   cameraCommand: { action: siteId !== s.siteId ? 'reset' : 'focus', nonce: s.cameraCommand.nonce + 1 } };
 }),
 hover: hovered => set({ hovered }),
 setSite: id => {
  if (sites.some(site => site.id === id)) set(s => ({ siteId: id, selection: { kind: 'site', id }, trackedTruckId: id + '-t1', search: '', filter: 'all', hovered: null, cameraCommand: { action: 'reset', nonce: s.cameraCommand.nonce + 1 } }));
 },
 setSearch: search => set({ search }), setFilter: filter => set({ filter }),
 toggleRunning: () => set(s => ({ running: !s.running })),
 toggleRoof: () => set(s => ({ roof: !s.roof })), toggleLabels: () => set(s => ({ labels: !s.labels })),
 setSpeed: speed => { if ([1, 6, 12, 24].includes(speed)) set({ speed }); },
 setQuality: quality => set({ quality }),
 camera: action => set(s => ({ cameraCommand: { action, nonce: s.cameraCommand.nonce + 1 } })),
 tick: () => set(s => s.running ? stepSimulation({ seconds: s.seconds, tickCount: s.tickCount, randomSeed: s.randomSeed, trucks: s.trucks, docks: s.docks, forklifts: s.forklifts, inventory: s.inventory, pallets: s.pallets, chargers: s.chargers, shipments: s.shipments, events: s.events }) : s),
}));
export function findEntity(s: Simulation, selection: Selection) {
 const collections = { site: sites, truck: s.trucks, dock: s.docks, forklift: s.forklifts, inventory: s.inventory, pallet: s.pallets, charger: s.chargers };
 return collections[selection.kind]?.find(e => e.id === selection.id);
}
export function matchesTruck(t: Truck, filter: WarehouseState['filter'], search: string) {
 const q = search.trim().toLocaleLowerCase('vi');
 return (filter === 'all' || t.status === filter) && (t.name + ' ' + t.plate + ' ' + t.carrier + ' ' + t.shipmentId).toLocaleLowerCase('vi').includes(q);
}
export function getMetrics(s: Simulation, siteId: string) {
 const site = sites.find(site => site.id === siteId), trucks = s.trucks.filter(t => t.siteId === siteId);
 const stock = s.inventory.filter(i => i.siteId === siteId).reduce((n, i) => n + i.quantity, 0);
 return { stock, stockDelta: stock - (site?.initialStock ?? 0), onTime: site?.onTime ?? 0,
  activeTrucks: trucks.filter(isAtSite).length, inbound: trucks.filter(t => t.inbound && isAtSite(t)).length,
  busyDocks: trucks.filter(isDocked).length, totalDocks: s.docks.filter(d => d.siteId === siteId).length,
  lowStock: s.inventory.filter(i => i.siteId === siteId && i.quantity < i.minimum).length,
  completed: trucks.filter(t => t.status === 'delivered').length, total: trucks.length,
  outbound: (site?.outbound ?? 0) + trucks.filter(t => !t.inbound).reduce((n, t) => n + t.cycle + (['departing','in_transit','delivered'].includes(t.status) ? 1 : 0), 0),
  putaways: (site?.putaways ?? 0) + trucks.filter(t => t.inbound).reduce((n, t) => n + t.cycle, 0) };
}
