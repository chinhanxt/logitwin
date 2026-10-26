import { expect, it } from 'vitest';
import { createSeed } from '../src/data/seed';
import { stepSimulation } from '../src/sim/engine';
const distance = (a: number[], b: number[]) => Math.hypot(a[0]-b[0],a[2]-b[2]);
it('keeps staged cargo in separate bays throughout repeated truck cycles', () => {
 let s=createSeed();
 for(let tick=0;tick<1800;tick++){
  const occupied=new Set<string>();
  for(const p of s.pallets.filter(p=>p.status==='staged'||p.status==='in_rack')){
   const key=p.siteId+':'+p.position.join(',');
   expect(occupied.has(key),p.id+' overlaps another pallet').toBe(false);occupied.add(key);
  }
  s=stepSimulation(s);
 }
});
it('keeps visible truck movement continuous through gate, docking and departure', () => {
 let s=createSeed();
 for(let tick=0;tick<500;tick++){
  const next=stepSimulation(s);
  for(const t of next.trucks){
   const before=s.trucks.find(b=>b.id===t.id)!;
   if(!['in_transit','delivered'].includes(t.status) && !['in_transit','delivered'].includes(before.status))
    expect(distance(t.position,before.position),`${t.id}: ${before.status} → ${t.status} at ${tick}`).toBeLessThanOrEqual(1.5);
  }
  s=next;
 }
});
it('keeps forklift movement continuous when acquiring work or going to charge', () => {
 let s=createSeed();s.forklifts[0].battery=19;
 for(let tick=0;tick<300;tick++){
  const next=stepSimulation(s);
  for(const f of next.forklifts)expect(distance(f.position,s.forklifts.find(b=>b.id===f.id)!.position),`${f.id}: ${f.status}`).toBeLessThanOrEqual(.65);
  s=next;
 }
});

it('steers along the driving direction and reverses into docks without snapping its heading', async () => {
 const {angleDelta,travelSeconds}=await import('../src/sim/motion');
 let s=createSeed();
 for(let tick=0;tick<800;tick++){
  const next=stepSimulation(s);
  for(const t of next.trucks){
   const before=s.trucks.find(b=>b.id===t.id)!;
   if(['in_transit','delivered'].includes(t.status)||['in_transit','delivered'].includes(before.status))continue;
   expect(Math.abs(angleDelta(before.heading,t.heading)),t.id+' steering').toBeLessThan(.4);
   const dx=t.position[0]-before.position[0],dz=t.position[2]-before.position[2],length=Math.hypot(dx,dz);
   if(length>.01){
    const alignment=(dx*Math.sin(t.heading)+dz*Math.cos(t.heading))/length;
    const reversing=(t.status==='docking'&&t.elapsed/travelSeconds.docking>=.5)||(before.status==='docking'&&['loading','unloading'].includes(t.status));
    expect(reversing?-alignment:alignment,t.id+' direction').toBeGreaterThan(.95);
   }
  }
  s=next;
 }
});
it('forklifts reach chargers along the service aisle before receiving energy', () => {
 let s=createSeed();s.forklifts[0].battery=19;
 s=stepSimulation(s);expect(s.forklifts[0].battery).toBe(19);
 for(let tick=0;tick<250 && s.forklifts[0].battery===19;tick++){
  s=stepSimulation(s);const f=s.forklifts[0];
  expect(f.position[2]>1.7 || f.position[0]>10.5).toBe(true);
 }
 expect(s.forklifts[0].battery).toBeGreaterThan(19);
});
