import { expect, it } from 'vitest';
import { createSeed } from '../src/data/seed';
import { driveForklift } from '../src/sim/traffic';
import { stepSimulation } from '../src/sim/engine';
import type { Position, Simulation } from '../src/data/model';
type Box={id:string;siteId:string;position:Position;heading:number;half:[number,number]};
function overlaps(a:Box,b:Box){
 if(Math.hypot(a.position[0]-b.position[0],a.position[2]-b.position[2])>=Math.hypot(...a.half)+Math.hypot(...b.half))return false;
 const axes=[a.heading,b.heading].flatMap(h=>[[Math.cos(h),-Math.sin(h)],[Math.sin(h),Math.cos(h)]]);
 return axes.every(([x,z])=>{
  const projection=(b:Box)=>b.half[0]*Math.abs(x*Math.cos(b.heading)-z*Math.sin(b.heading))+b.half[1]*Math.abs(x*Math.sin(b.heading)+z*Math.cos(b.heading));
  return Math.abs((a.position[0]-b.position[0])*x+(a.position[2]-b.position[2])*z)<projection(a)+projection(b)-.015;
 });
}
function checkTraffic(s:Simulation,alpha=1){
 const pose=(v:Simulation['trucks'][number]|Simulation['forklifts'][number],offset=0):Position=>{
  const heading=v.previousHeading+Math.atan2(Math.sin(v.heading-v.previousHeading),Math.cos(v.heading-v.previousHeading))*alpha;
  return [v.previousPosition[0]+(v.position[0]-v.previousPosition[0])*alpha+Math.sin(heading)*offset,0,v.previousPosition[2]+(v.position[2]-v.previousPosition[2])*alpha+Math.cos(heading)*offset];
 };
 const angle=(v:Simulation['trucks'][number]|Simulation['forklifts'][number])=>v.previousHeading+Math.atan2(Math.sin(v.heading-v.previousHeading),Math.cos(v.heading-v.previousHeading))*alpha;
 const trucks:Box[]=s.trucks.filter(t=>!['in_transit','delivered'].includes(t.status)).map(t=>({...t,position:pose(t,.045),heading:angle(t),half:[1.11,2.385]}));
 const forklifts:Box[]=s.forklifts.map(f=>({...f,position:pose(f,.5125),heading:angle(f),half:[.57,1.2125]}));
 const pallets:Box[]=s.pallets.filter(p=>p.status==='staged'||p.status==='in_rack').map(p=>({...p,heading:0,half:[.55,.45]}));
 const clear=(a:Box,b:Box)=>{if(a.siteId===b.siteId&&overlaps(a,b))expect.fail(`${a.id} intersects ${b.id} at ${s.tickCount}, frame ${alpha}`);};
 const vehicles=[...trucks,...forklifts];
 for(const [i,a]of vehicles.entries())for(const b of vehicles.slice(i+1))clear(a,b);
 for(const truck of trucks)for(const pallet of pallets)clear(truck,pallet);
 for(const f of s.forklifts){
  const full=forklifts.find(b=>b.id===f.id)!,body:Box={...full,position:pose(f),half:[.57,.7]};
  const truck=s.trucks.find(t=>t.id===f.truckId),pickup=truck?.palletIds[Math.floor((truck.progress+.000001)*6/100)];
  for(const p of pallets){clear(body,p);if(p.id!==f.forkContact && !(f.status==='fetching'&&p.id===pickup))clear(full,p);}
 }
}
it('vehicles keep their physical footprints clear of other vehicles and stored cargo',()=>{
 let s=createSeed();checkTraffic(s);
 for(let i=0;i<1800;i++){s=stepSimulation(s);for(const alpha of [0,.5,1])checkTraffic(s,alpha);}
},60000);
it('defers a new cargo cycle while a forklift occupies its yard slot',()=>{
 const s=createSeed(),truck=s.trucks[0],forklift=s.forklifts[0],pallet=s.pallets.find(p=>p.id===truck.palletIds[0])!;
 truck.status='delivered';truck.elapsed=119;truck.dockId=undefined;
 for(const p of s.pallets.filter(p=>truck.palletIds.includes(p.id)))p.status='loaded';
 forklift.position=[...pallet.position];forklift.previousPosition=[...forklift.position];forklift.heading=0;
 const blocked=stepSimulation(s);
 expect(blocked.trucks[0].cycle).toBe(0);expect(blocked.pallets.find(p=>p.id===pallet.id)?.status).toBe('loaded');
 blocked.forklifts[0].position=[16.5,0,-10];blocked.forklifts[0].previousPosition=[16.5,0,-10];
 expect(stepSimulation(blocked).trucks[0].cycle).toBe(1);
});

it('oncoming forklifts both get through the west cargo aisle without crossing each other',()=>{
 const s=createSeed();s.trucks=[];s.forklifts=s.forklifts.slice(0,2);
 const [a,b]=s.forklifts;a.position=[-31,0,6];a.heading=Math.PI/2;b.position=[-27,0,6];b.heading=-Math.PI/2;
 const goals:Position[]=[[-21,0,6],[-43,0,5]];const arrived=[false,false];
 for(let tick=0;tick<400&&!arrived.every(Boolean);tick++){
  s.seconds++;s.tickCount++;
  for(const f of s.forklifts){f.previousPosition=[...f.position];f.previousHeading=f.heading;}
  s.forklifts.forEach((f,i)=>{arrived[i]=driveForklift(f,goals[i],s);});
  for(const alpha of [0,.5,1])checkTraffic(s,alpha);
 }
 expect(arrived).toEqual([true,true]);
});
