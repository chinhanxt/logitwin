import type { Simulation, Truck, VehicleStatus, Position } from '../data/model';
import { sites } from '../data/seed';
import { forkPosition, travelSeconds, truckPose, yardPosition } from './motion';
import { driveForklift, obstacles, overlap, sweptClear, truckFootprint } from './traffic';
const duration: Partial<Record<VehicleStatus, number>> = { ...travelSeconds, loading: 480, unloading: 480, in_transit: 300, delivered: 120 };
export const isAtSite = (t: Truck) => ['at_gate', 'docking', 'loading', 'unloading', 'departing'].includes(t.status);
export const isDocked = (t: Truck) => ['docking', 'loading', 'unloading'].includes(t.status);
export function formatTime(seconds: number) {
 const minute = Math.floor(Math.max(0, seconds) / 60);
 return String(Math.floor(minute / 60) % 24).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
}
export function remainingSeconds(t: Truck) {
 if (t.status === 'delivered') return 0;
 if (t.status === 'loading' || t.status === 'unloading') return Math.ceil((100 - t.progress) / 100 * 480);
 return Math.max(0, (duration[t.status] ?? 12) - t.elapsed);
}
export function deliverySeconds(t: Truck) {
 const later = { en_route: 1002, at_gate: 990, docking: 870, loading: 390, unloading: 390, departing: 300, in_transit: 0, delivered: 0 };
 return remainingSeconds(t) + later[t.status];
}
export function truckPosition(t: Truck, s: Pick<Simulation, 'docks'>): Position {
 return truckPose(t,s).position;
}
// One fixed simulated second; the renderer only interpolates engine positions.
export function stepSimulation(previous: Simulation): Simulation {
 const s: Simulation = structuredClone(previous);
 s.seconds++; s.tickCount++;
 const event = (entityId: string, siteId: string, type: string) => s.events.push({ t: s.seconds, entityId, siteId, type });
 const transition = (t: Truck, status: VehicleStatus) => {
  t.status = status; t.elapsed = 0; t.updatedAt = s.seconds; event(t.id, t.siteId, status);
  if (!isDocked(t) && status !== 'departing') t.dockId = undefined;
 };
 const occupied = new Set(s.trucks.filter(t=>isDocked(t)||t.status==='departing').map(t => t.dockId));
 for (const t of s.trucks) {
  const before=structuredClone(t),eventCount=s.events.length;
  t.previousPosition=[...t.position];t.previousHeading=t.heading;
  t.elapsed++;
  if (t.status === 'en_route' && t.elapsed >= travelSeconds.en_route) transition(t, 'at_gate');
  else if (t.status === 'at_gate' && t.elapsed >= 12 && !s.trucks.some(other=>other.id!==t.id && other.siteId===t.siteId && other.status==='at_gate' && other.position[0]<t.position[0])) {
   const dock = s.docks.find(d => d.siteId === t.siteId && !occupied.has(d.id) && !s.docks.some(other=>occupied.has(other.id)&&other.siteId===d.siteId&&Math.abs(other.position[0]-d.position[0])<3.8) && d.direction === (t.inbound ? 'in' : 'out'));
   if (dock && !s.trucks.some(other=>other.siteId===t.siteId && ['docking','departing'].includes(other.status))) { occupied.add(dock.id); t.dockId = dock.id; transition(t, 'docking'); }
  } else if (t.status === 'docking' && t.elapsed >= travelSeconds.docking) { t.progress = 0; transition(t, t.inbound ? 'unloading' : 'loading'); }
  else if (['loading','unloading'].includes(t.status) && t.progress>=100 && !s.trucks.some(other=>other.id!==t.id&&other.siteId===t.siteId&&['docking','departing'].includes(other.status))) transition(t,'departing');
  else if (t.status === 'departing' && t.elapsed >= travelSeconds.departing) transition(t, 'in_transit');
  else if (t.status === 'in_transit' && t.elapsed >= 300) transition(t, 'delivered');
  else if (t.status === 'delivered' && t.elapsed >= 120) {
   const entry={position:[58,0,15.5] as Position,heading:-Math.PI/2};
   const solid=obstacles(s,t.siteId,t.id),vehicles=solid.filter(o=>s.forklifts.some(f=>f.id===o.id)||s.trucks.some(other=>other.id===o.id));
   const cargoBlocked=!t.inbound&&t.palletIds.some(id=>vehicles.some(o=>overlap({id,position:yardPosition({id}),heading:0,half:[.55,.45]},o)));
   if(cargoBlocked||!sweptClear(entry,entry,truckFootprint,solid)){t.elapsed=before.elapsed;t.speed=0;continue;}
   s.randomSeed = (Math.imul(s.randomSeed, 1664525) + 1013904223) >>> 0;
   const reserved=s.trucks.filter(other=>other.id!==t.id&&other.siteId===t.siteId&&['en_route','at_gate','docking'].includes(other.status)).map(other=>other.gateSlot);
   t.gateSlot=[0,1,2,3].find(slot=>!reserved.includes(slot)) ?? 3;
   transition(t, 'en_route'); t.progress = 0; t.cycle++;
   // The seeded demo repeats shipment/cargo identities at an explicit cycle boundary.
   for (const id of t.palletIds) {
    const p = s.pallets.find(p => p.id === id)!;
    p.status = t.inbound ? 'loaded' : 'staged'; p.location = t.inbound ? t.name : 'Yard'; p.position = yardPosition(p);
    p.forkliftId = undefined;
   }
   s.shipments.find(sh => sh.truckId === t.id)!.steps = [{ key: 'confirmed', at: s.seconds - 60 }, { key: 'picked', at: s.seconds }, { key: 'loading' }, { key: 'in_transit' }, { key: 'delivered' }];
  }
  const pose=truckPose(t,s);
  const hidden=['in_transit','delivered'];
  const solid=obstacles(s,t.siteId,t.id);
  const clear=hidden.includes(t.status) || (hidden.includes(before.status) ? sweptClear(pose,pose,truckFootprint,solid) : sweptClear(before,pose,truckFootprint,solid,[],true));
  if(hidden.includes(before.status)&&!hidden.includes(t.status)){t.previousPosition=[...pose.position];t.previousHeading=pose.heading;}
  if(!clear){if(t.dockId!==before.dockId)occupied.delete(t.dockId);s.events.length=eventCount;Object.assign(t,before);t.previousPosition=[...before.position];t.previousHeading=before.heading;t.speed=0;}
  else {t.speed=hidden.includes(before.status)?0:Math.hypot(pose.position[0]-t.position[0],pose.position[2]-t.position[2]);Object.assign(t,pose);}
  t.updatedAt=s.seconds;
 }
 const assigned = new Set<string>();
 const owners = new Map(s.forklifts.filter(f=>f.truckId && (f.battery>20 || f.carrying) && f.status!=='charging').map(f=>[f.truckId,f.id]));
 for (const f of s.forklifts) {
  f.previousPosition=[...f.position];f.previousHeading=f.heading;
  const oldStatus=f.status;
  if (f.status==='charging') {
   const c=s.chargers.find(c=>c.id===f.chargerId)!;
   if(driveForklift(f,[c.position[0]-1,0,c.position[2]],s)) {
    f.battery=Math.min(100,f.battery+c.rate/60);c.energyKwh+=.002;
    if(f.battery>=99.999){f.battery=100;c.forkliftId=undefined;f.chargerId=undefined;f.status='idle';}
   }
  } else if(f.battery<=20 && !f.carrying) {
   const c=s.chargers.find(c=>c.siteId===f.siteId && !c.forkliftId);
   if(c){f.status='charging';f.chargerId=c.id;c.forkliftId=f.id;c.sessions++;f.truckId=undefined;f.taskPause=0;}
  } else {
   const t=s.trucks.find(t=>t.id===f.truckId && ['loading','unloading'].includes(t.status) && t.progress<100 && !assigned.has(t.id)) ?? s.trucks.find(t=>t.siteId===f.siteId && ['loading','unloading'].includes(t.status) && t.progress<100 && !assigned.has(t.id) && !owners.has(t.id));
   f.truckId=t?.id;
   if(t) {
    assigned.add(t.id);f.battery=Math.max(0,f.battery-.025);
    const completed=Math.floor((t.progress+.000001)*6/100), p=s.pallets.find(p=>p.id===t.palletIds[completed])!;
    const item=s.inventory.find(i=>i.siteId===t.siteId && i.sku===p.sku)!;
    const side:Position=[t.position[0]+1.95,0,5.6];
    const receiving=yardPosition(p);
    const pickup=t.inbound?side:p.position, dropoff=t.inbound?receiving:side;
    const target=f.carrying?dropoff:pickup;
    f.status=f.carrying?(t.inbound?'unloading_truck':'loading_truck'):'fetching';
    const arrived=driveForklift(f,[target[0],0,target[2]-1.2],s,!f.carrying?p.id:undefined);
    if(f.carrying){p.position=forkPosition(f);p.location=f.name;}
    if(arrived) {
     f.taskPause++;
     if(f.taskPause>=2) {
      f.taskPause=0;
      if(!f.carrying){f.carrying=p.id;p.status='moving';p.forkliftId=f.id;p.position=forkPosition(f);p.location=f.name;event(p.id,p.siteId,'moving');}
      else {
       const stock=s.inventory.filter(i=>i.siteId===t.siteId).reduce((n,i)=>n+i.quantity,0), capacity=sites.find(site=>site.id===t.siteId)!.capacity;
       if(t.inbound?stock<capacity:item.quantity>0){
        item.quantity+=t.inbound?1:-1;f.movesToday++;t.progress=Math.min(100,(completed+1)*100/6);
        p.status=t.inbound?'in_rack':'loaded';p.location=t.inbound?'Receiving · '+item.location:t.name;
        p.position=t.inbound?[...receiving]:[...t.position];p.forkliftId=undefined;f.carrying=undefined;f.forkContact=p.id;
        if(t.inbound)p.receivedAt=s.seconds;
        event(p.id,p.siteId,p.status);event(t.id,t.siteId,t.inbound?'pallet_received':'pallet_loaded');
        if(t.progress>=99.9999)t.progress=100;
       }
      }
     }
    } else f.taskPause=0;
   } else {f.status='idle';f.taskPause=0;const parking=Number(f.id.split('-f')[1]);driveForklift(f,[16.5,0,-10+(parking-1)*4],s);}
  }
  f.active=!['charging','idle'].includes(f.status);
  if(!f.active)f.truckId=undefined;
  if(f.carrying){const p=s.pallets.find(p=>p.id===f.carrying)!;p.position=forkPosition(f);}
  f.updatedAt=s.seconds;
  if(oldStatus!==f.status)event(f.id,f.siteId,f.status);
 }
 for (const sh of s.shipments) {
  const t=s.trucks.find(t=>t.id===sh.truckId)!; sh.status=t.status;
  for (const [key,condition] of [['loading',['loading','unloading','departing','in_transit','delivered'].includes(t.status)],['in_transit',['in_transit','delivered'].includes(t.status)],['delivered',t.status==='delivered']] as const) {
   const milestone=sh.steps.find(step=>step.key===key)!;if(condition&&milestone.at===undefined)milestone.at=s.seconds;
  }
  sh.eta=formatTime(t.status==='delivered' ? sh.steps[4].at! : s.seconds+deliverySeconds(t));
 }
 s.events=s.events.slice(-500);
 return s;
}
