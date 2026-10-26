import type { Site, Simulation, VehicleStatus, Position } from './model';
export const sites: Site[] = [
 { id: 'sgn', code: 'WH-01', name: 'Bến Sông Hub', city: 'TP. Hồ Chí Minh', address: '12 Đường Bến Sông, Cát Lái', area: '12.800 m²', kind: 'depot', capacity: 1800, initialStock: 1412, dockCount: 2, onTime: 96.6, outbound: 23, putaways: 15, accent: '#144fcb' },
 { id: 'han', code: 'WH-02', name: 'Bắc Thành DC', city: 'Hà Nội', address: '48 Đại lộ Bắc Thành, Sóc Sơn', area: '24.600 m²', kind: 'distribution_center', capacity: 4200, initialStock: 3310, dockCount: 4, onTime: 98.2, outbound: 21, putaways: 35, accent: '#144fcb' },
 { id: 'dad', code: 'WH-03', name: 'Đông Hải Cold Store', city: 'Đà Nẵng', address: '7 Đường Cảng Đông, Liên Chiểu', area: '8.200 m²', kind: 'cold_store', capacity: 1400, initialStock: 990, dockCount: 3, onTime: 96, outbound: 31, putaways: 20, accent: '#144fcb' },
 { id: 'bdg', code: 'WH-04', name: 'Nam Bình Cross-Dock', city: 'Bình Dương', address: '22 Đại lộ Nam Bình, Dĩ An', area: '16.400 m²', kind: 'cross_dock', capacity: 1600, initialStock: 610, dockCount: 6, onTime: 96.2, outbound: 29, putaways: 20, accent: '#144fcb' },
 { id: 'hph', code: 'WH-05', name: 'Tây Cảng Robotics', city: 'Hải Phòng', address: '30 Đường Tây Cảng, Hải An', area: '18.500 m²', kind: 'automated_dc', capacity: 2400, initialStock: 1730, dockCount: 4, onTime: 95.9, outbound: 33, putaways: 25, accent: '#144fcb' },
];
import { truckPose, yardPosition } from '../sim/motion';
const goods = ['Thùng carton (M)', 'Hộp nhựa công nghiệp', 'Mũ bảo hộ', 'Băng keo đóng gói'];
export function createSeed(seed = 1337): Simulation {
 const data: Simulation = { seconds: 34800, randomSeed: seed >>> 0, tickCount: 0, docks: [], trucks: [], forklifts: [], inventory: [], pallets: [], chargers: [], shipments: [], events: [] };
 sites.forEach((site, index) => {
  for (let i = 0; i < site.dockCount; i++) data.docks.push({ id: site.id + '-d' + (i + 1), siteId: site.id, name: 'Bay ' + (i + 1), direction: i % 2 ? 'in' : 'out', position: [-8.25 + i * (16.5 / Math.max(1, site.dockCount - 1)), 0, 1.65] });
  const quantities = [Math.floor(site.initialStock * .4), Math.floor(site.initialStock * .35), 18];
  quantities.push(site.initialStock - quantities.reduce((a, b) => a + b, 0));
  for (let i = 0; i < 4; i++) data.inventory.push({ id: site.id + '-i' + (i + 1), siteId: site.id, name: site.kind === 'cold_store' ? ['Đậu Hà Lan đông lạnh', 'Sữa tươi tiệt trùng', 'Găng tay nitrile', 'Thùng cách nhiệt'][i] : goods[i], sku: 'SKU-' + (1000 + index * 100 + i), quantity: quantities[i], minimum: 40, location: 'A-' + (i + 1), position: [-6.5 + i * 4.2, 0, -5] });
  for (let i = 0; i < 4; i++) {
   const id = site.id + '-t' + (i + 1), dock = data.docks.find(d => d.id === site.id + '-d' + (i===1 && site.dockCount===6 ? 4 : i + 1));
   const status: VehicleStatus = i === 0 ? 'loading' : i === 1 ? 'unloading' : i === 2 ? 'en_route' : 'at_gate';
   const position: Position = i < 2 && dock ? [dock.position[0], 0, 4.5] : i === 2 ? [17, 0, 14] : [15, 0, 9];
   const truck = { id, siteId: site.id, name: 'TRK-' + (2051 + index * 100 + i * 17), plate: [51, 29, 43, 61, 15][index] + 'C · ' + ['268.39', '519.82', '406.17', '832.65'][i], carrier: ['Vận tải Lam Sơn', 'Bến Việt Cargo', 'Mây Bắc Logistics', 'Đường Xanh'][i], driver: ['Minh Tuấn', 'Hoàng Nam', 'Anh Dũng', 'Quốc Huy'][i], status, dockId: i < 2 ? dock?.id : undefined, shipmentId: 'SHP-' + (78442 + index * 100 + i), position, color: ['#2863d9', '#4aada5', '#e2a060', '#334d7f'][i], previousPosition: [...position] as Position, previousHeading: i < 2 ? 0 : -Math.PI/2, heading: i < 2 ? 0 : -Math.PI/2, gateSlot: i === 2 ? 1 : 0, speed: 0, progress: i < 2 ? (i ? 100 / 6 : 100 / 3) : 0, elapsed: i === 2 ? 60 : 0, updatedAt: data.seconds, inbound: i % 2 === 1, cycle: 0, palletIds: Array.from({length:6},(_,j)=>site.id+'-p'+(i*6+j+1)) };
   Object.assign(truck,truckPose(truck,data));truck.previousPosition=[...truck.position];truck.previousHeading=truck.heading;
   data.trucks.push(truck);
   data.shipments.push({ id: truck.shipmentId, siteId: site.id, truckId: id, customer: ['An Phú Retail', 'Bình Minh Supply', 'Tân Cảng Mart', 'Việt An Trade'][i], destination: ['Bình Dương', 'Đồng Nai', 'Hải Phòng', 'Cần Thơ'][(i + index) % 4], pallets: 6, weight: '2,4 tấn', eta: '10:10', status, steps: [{ key: 'confirmed', at: data.seconds - 1800 }, { key: 'picked', at: data.seconds - 600 }, { key: 'loading', ...(i < 2 ? { at: data.seconds - 60 } : {}) }, { key: 'in_transit' }, { key: 'delivered' }] });
  }
  for (let i = 0; i < 3; i++) {
   const id = site.id + '-f' + (i + 1), chargerId = site.id + '-c' + (i + 1);
   data.forklifts.push({ id, siteId: site.id, name: 'FL-' + String(index * 3 + i + 1).padStart(2, '0'), driver: ['Thanh Hà', 'Đức Anh', 'Thu Mai'][i], model: site.kind === 'automated_dc' ? 'AGV R-18' : 'Điện E-18 · 1,8 tấn', battery: [84, 69, 35][i], position: i < 2 ? [-5 + i * 10, 0, 9] : [12, 0, -5], active: i < 2, updatedAt: data.seconds, status: i < 2 ? 'idle' : 'charging', previousPosition: i < 2 ? [-5+i*10,0,9] : [12,0,-5], previousHeading: 0, heading: 0, speed: 0, taskPause: 0, movesToday: 12 + i * 4, chargerId: i === 2 ? chargerId : undefined });
   data.chargers.push({ id: chargerId, siteId: site.id, name: 'C' + (i + 1), position: [13, 0, -9 + i * 2], forkliftId: i === 2 ? id : undefined, sessions: i === 2 ? 3 : 2, energyKwh: 4.8 + i, rate: 6 });
  }
  for (let i = 0; i < 24; i++) {
   const item = data.inventory.filter(it => it.siteId === site.id)[i % 6 % 4], truck = data.trucks.filter(t=>t.siteId===site.id)[Math.floor(i/6)];
   const handled = i%6 < Math.floor((truck.progress+.000001)*6/100);
   const status = truck.inbound ? (handled ? 'in_rack' : 'loaded') : (handled ? 'loaded' : 'staged');
   const position: Position = status==='in_rack' ? [item.position[0],.3,item.position[2]+1.5] : yardPosition({id:site.id+'-p'+(i+1)});
   data.pallets.push({ id: site.id + '-p' + (i + 1), siteId: site.id, name: item.name, sku: item.sku, quantity: 48, weightKg: 400, lot: 'LOT-261017-' + (index + 1) + (i + 1), receivedAt: data.seconds - 3600, status, location: status==='loaded' ? truck.name : status==='in_rack' ? item.location : 'Yard '+(i+1), position });

  }
 });
 return data;
}
