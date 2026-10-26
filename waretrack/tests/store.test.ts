import { beforeEach, describe, expect, it } from 'vitest';
import { createSeed, sites } from '../src/data/seed';
import { getMetrics, useWarehouse } from '../src/data/store';
import { forkPosition, travelSeconds } from '../src/sim/motion';
import { deliverySeconds, isDocked, isAtSite, remainingSeconds, stepSimulation } from '../src/sim/engine';
beforeEach(() => useWarehouse.setState({ ...createSeed(), siteId:'sgn', selection:{kind:'site',id:'sgn'}, trackedTruckId:'sgn-t1', running:true, roof:true, search:'', speed:12, filter:'all' }));
describe('Five-site seed', () => {
 it('has original sites and complete site-scoped references', () => {
  const s=createSeed();
  expect(new Set(sites.map(s => s.kind)).size).toBe(5);
  expect([s.docks.length,s.trucks.length,s.forklifts.length,s.pallets.length,s.chargers.length]).toEqual([19,20,15,120,15]);
  for (const t of s.trucks) {
   expect(s.shipments.find(sh => sh.id===t.shipmentId)?.truckId).toBe(t.id);
   if(t.dockId) expect(s.docks.find(d=>d.id===t.dockId)?.siteId).toBe(t.siteId);
  }
  for(const site of sites) expect(getMetrics(s,site.id).stock).toBe(site.initialStock);
  expect(getMetrics(s,'sgn')).toMatchObject({activeTrucks:3,busyDocks:2,onTime:96.6});
 });
});
describe('Selection and controls', () => {
 it('switches site coherently, clears search, and rejects unknown IDs', () => {
  const s=useWarehouse.getState(); s.setSearch('old'); s.setSite('dad');
  expect(useWarehouse.getState()).toMatchObject({siteId:'dad',selection:{kind:'site',id:'dad'},trackedTruckId:'dad-t1',search:''});
  useWarehouse.getState().setSite('../../bad');
  useWarehouse.getState().select({kind:'truck',id:'missing'});
  expect(useWarehouse.getState().siteId).toBe('dad');
  useWarehouse.getState().select({kind:'truck',id:'han-t2'});
  expect(useWarehouse.getState()).toMatchObject({siteId:'han',trackedTruckId:'han-t2',selection:{kind:'truck',id:'han-t2'}});
 });
 it('tracks the selected truck while inspecting another entity and respects clearing', () => {
  useWarehouse.getState().select({kind:'truck',id:'sgn-t2'});
  useWarehouse.getState().select({kind:'charger',id:'sgn-c1'});
  expect(useWarehouse.getState().trackedTruckId).toBe('sgn-t2');
  useWarehouse.getState().select(null); useWarehouse.getState().tick();
  expect(useWarehouse.getState().selection).toBeNull();
  useWarehouse.getState().select({kind:'inventory',id:'sgn-i1'});
  expect(useWarehouse.getState().roof).toBe(false);
 });
 it('freezes simulation on pause and validates speed', () => {
  useWarehouse.getState().toggleRunning();const before=useWarehouse.getState();
  useWarehouse.getState().tick();expect(useWarehouse.getState()).toBe(before);
  useWarehouse.getState().toggleRunning();useWarehouse.getState().tick();
  expect(useWarehouse.getState().seconds).toBe(before.seconds+1);
  useWarehouse.getState().setSpeed(-1);expect(useWarehouse.getState().speed).toBe(12);
 });
});
describe('Pure fixed-step simulation', () => {
 it('keeps transferred pallet identities stable and frees forklift ownership', () => {
  let s=createSeed();
  for(let i=0;i<500 && (s.trucks[0].progress<50 || s.trucks[1].progress<100/3);i++)s=stepSimulation(s);
  const out=s.trucks[0].palletIds[2], incoming=s.trucks[1].palletIds[1];
  expect(s.pallets.find(p=>p.id===out)).toMatchObject({status:'loaded',location:s.trucks[0].name,forkliftId:undefined});
  expect(s.pallets.find(p=>p.id===incoming)).toMatchObject({status:'in_rack',forkliftId:undefined});
  s=stepSimulation(s);
  expect(s.pallets.find(p=>p.id===out)?.status).toBe('loaded');
  expect(s.pallets.find(p=>p.id===incoming)?.status).toBe('in_rack');
 });
 it('includes future phases in delivery ETA and keeps delivered time fixed', () => {
  let s=createSeed();const t=s.trucks[0];t.status='departing';t.elapsed=0;t.dockId=undefined;
  expect(deliverySeconds(t)).toBe(travelSeconds.departing+300);
  t.status='en_route';t.elapsed=0;expect(deliverySeconds(t)).toBe(travelSeconds.en_route+12+travelSeconds.docking+480+travelSeconds.departing+300);
  t.status='in_transit';t.elapsed=299;s=stepSimulation(s);expect(s.trucks[0].status).toBe('delivered');
  const eta=s.shipments[0].eta;s=stepSimulation(s);expect(s.shipments[0].eta).toBe(eta);
 });

 it('is deterministic and never mutates its input', () => {
  const initial=createSeed(42);initial.trucks[0].status='delivered';initial.trucks[0].elapsed=119;const copy=structuredClone(initial);
  let a=initial,b=structuredClone(initial);
  for(let i=0;i<700;i++){ a=stepSimulation(a);b=stepSimulation(b); }
  expect(a).toEqual(b);expect(initial).toEqual(copy);expect(a.randomSeed).not.toBe(initial.randomSeed);
 });
 it('reserves distinct direction-compatible docks and transitions through docking', () => {
  let s=createSeed();s.trucks[0].status='delivered';s.trucks[0].dockId=undefined;
  s.trucks[1].status='delivered';s.trucks[1].dockId=undefined;
  s.trucks[2].status='at_gate';s.trucks[2].elapsed=12;s.trucks[3].elapsed=12;
  s=stepSimulation(s);
  for(let i=0;i<350 && !['loading','unloading'].every(status=>s.trucks.some(t=>t.siteId==='sgn' && t.status===status));i++)s=stepSimulation(s);
  expect(s.trucks[2].status).toBe('loading');expect(s.trucks[3].status).toBe('unloading');
  expect(s.trucks[2].dockId).not.toBe(s.trucks[3].dockId);
 });
 it('links cargo transfers to stock, working forklifts, and moving pallets', () => {
  let s=createSeed();const before=getMetrics(s,'sgn').stock;
  for(let i=0;i<150 && !s.forklifts[0].carrying;i++)s=stepSimulation(s);
  const f=s.forklifts[0],p=s.pallets.find(p=>p.id===f.carrying)!;
  expect(f.truckId).toBe(s.trucks[0].id);
  expect(p).toMatchObject({status:'moving',forkliftId:f.id,location:f.name});
  expect(p.position).toEqual(forkPosition(f));
  for(let i=0;i<150 && !s.events.some(e=>e.siteId==='sgn' && e.type==='pallet_loaded');i++)s=stepSimulation(s);
  const changes=s.events.filter(e=>e.siteId==='sgn'&&['pallet_received','pallet_loaded'].includes(e.type));
  expect(changes.length).toBeGreaterThan(0);
  expect(getMetrics(s,'sgn').stock-before).toBe(changes.filter(e=>e.type==='pallet_received').length-changes.filter(e=>e.type==='pallet_loaded').length);
 });
 it('charges low batteries, releases chargers, and resumes work', () => {
  let s=createSeed();s.forklifts[0].battery=19;
  s=stepSimulation(s);
  expect(s.forklifts[0]).toMatchObject({status:'charging',active:false});
  const c=s.chargers.find(c=>c.id===s.forklifts[0].chargerId)!;expect(c.forkliftId).toBe(s.forklifts[0].id);
  const energy=c.energyKwh;
  for(let i=0;i<1300 && s.forklifts[0].status==='charging';i++)s=stepSimulation(s);
  expect(s.chargers.find(charger=>charger.id===c.id)!.energyKwh).toBeGreaterThan(energy);
  expect(s.forklifts[0].status).not.toBe('charging');
  expect(s.forklifts[0].battery).toBeGreaterThan(80);
 });
 it('completes a cycle for every truck across 60 simulated minutes without invalid occupancy or inventory', () => {
  let s=createSeed(), transitions=new Set<string>(), receipts=0,loads=0;
  const stock=s.inventory.reduce((n,i)=>n+i.quantity,0);
  for(let i=0;i<3600;i++){
   s=stepSimulation(s);
   const docks=s.trucks.filter(isDocked).map(t=>t.dockId);
   expect(new Set(docks).size).toBe(docks.length);
   for(const t of s.trucks){
    expect(remainingSeconds(t)).toBeGreaterThanOrEqual(0);
    expect(t.progress).toBeGreaterThanOrEqual(0);expect(t.progress).toBeLessThanOrEqual(100);
    expect(s.shipments.find(sh=>sh.truckId===t.id)?.status).toBe(t.status);
    if(isDocked(t)){const d=s.docks.find(d=>d.id===t.dockId)!;expect(d.siteId).toBe(t.siteId);expect(d.direction).toBe(t.inbound?'in':'out');}
    expect(t.position.every(Number.isFinite)).toBe(true);
   }
   for(const f of s.forklifts){if(f.carrying)expect(s.pallets.find(p=>p.id===f.carrying)).toMatchObject({status:'moving',forkliftId:f.id});expect(f.battery).toBeGreaterThanOrEqual(0);expect(f.battery).toBeLessThanOrEqual(100);}
   for(const e of s.events.filter(e=>e.t===s.seconds)){transitions.add(e.type);if(e.type==='pallet_received')receipts++;if(e.type==='pallet_loaded')loads++;}
   for(const site of sites){const m=getMetrics(s,site.id);expect(m.stock).toBeGreaterThanOrEqual(0);expect(m.stock).toBeLessThanOrEqual(site.capacity);expect(m.activeTrucks).toBe(s.trucks.filter(t=>t.siteId===site.id&&isAtSite(t)).length);}
  }
  expect(s.seconds).toBe(34800+3600);
  expect(s.trucks.filter(t=>t.cycle<1).map(t=>t.id)).toEqual([]);
  for(const status of ['en_route','at_gate','docking','loading','unloading','departing','in_transit','delivered'])expect(transitions.has(status)).toBe(true);
  expect(s.inventory.reduce((n,i)=>n+i.quantity,0)).toBe(stock+receipts-loads);
  expect(s.events.length).toBeLessThanOrEqual(500);
 },60000);
});
