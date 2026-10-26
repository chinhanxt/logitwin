import type { Position, Simulation } from '../data/model';
import { angleDelta, type Pose } from './motion';
export interface Footprint extends Pose { id: string; half: [number,number]; offset?: number; previousPosition?: Position; previousHeading?: number }
export function overlap(a:Footprint,b:Footprint,clearance=.06){
 const ca=Math.cos(a.heading),sa=Math.sin(a.heading),cb=Math.cos(b.heading),sb=Math.sin(b.heading);
 const dx=a.position[0]+sa*(a.offset??0)-b.position[0]-sb*(b.offset??0);
 const dz=a.position[2]+ca*(a.offset??0)-b.position[2]-cb*(b.offset??0);
 const [aw,ad]=a.half,[bw,bd]=b.half;
 if(Math.abs(dx)>=Math.abs(ca)*aw+Math.abs(sa)*ad+Math.abs(cb)*bw+Math.abs(sb)*bd+clearance || Math.abs(dz)>=Math.abs(sa)*aw+Math.abs(ca)*ad+Math.abs(sb)*bw+Math.abs(cb)*bd+clearance)return false;
 const cosine=Math.abs(ca*cb+sa*sb),sine=Math.abs(sa*cb-ca*sb);
 return Math.abs(dx*ca-dz*sa)<aw+bw*cosine+bd*sine+clearance && Math.abs(dx*sa+dz*ca)<ad+bw*sine+bd*cosine+clearance && Math.abs(dx*cb-dz*sb)<bw+aw*cosine+ad*sine+clearance && Math.abs(dx*sb+dz*cb)<bd+aw*sine+ad*cosine+clearance;
}
export const truckFootprint=(pose:Pose,id='truck'):Footprint=>({...pose,id,half:[1.11,2.385],offset:.045});
export const forkliftFootprint=(pose:Pose,id='forklift'):Footprint=>({...pose,id,half:[.57,1.2125],offset:.5125});
const box=(id:string,x:number,z:number,w:number,d:number):Footprint=>({id,position:[x,0,z],heading:0,half:[w/2,d/2]});
// Ground paint and low charger pads are traversable; walls, trunks and cabinets are solid.
export function obstacles(s:Simulation,siteId:string,exclude:string):Footprint[]{
 return [
  box('warehouse',0,-4,20.6,12),box('office',-13.2,-5.9,6,8),box('container',-14.6,3.8,4.6,2.1),
  box('east-shed',32,-14,18.3,29.3),box('north-shed',2,-32,29.3,17.3),box('west-shed',-29,-22,24.3,18.3),
  box('lamp-west',-15,10,.12,.12),box('lamp-east',16,10,.12,.12),
  ...[-47,47].map(x=>box('fence',x,-16.5,.12,55)),
  ...[-39,-32.8,-26.6].flatMap(x=>[9,12].map(z=>box('stacked-container',x,z,5.5,2.5))),
  ...(!s.trucks.some(t=>t.id===exclude)?s.docks.filter(d=>d.siteId===siteId).map(d=>box(d.id,d.position[0],d.position[2]+.8,2.5,1.4)):[]),
  ...[-18.8,19.6].flatMap(x=>[-11,-6,-.8,4.5,9].map(z=>box('tree',x,z,1.7,1.7))),
  ...[-16,-10,-4,2,8,14].flatMap(x=>[-13.6,18].map(z=>box('tree',x,z,1.7,1.7))),
  ...s.chargers.filter(c=>c.siteId===siteId).map(c=>box(c.id,c.position[0],c.position[2],.72,.57)),
  ...s.pallets.filter(p=>p.siteId===siteId && p.id!==exclude && ['staged','in_rack'].includes(p.status)).map(p=>box(p.id,p.position[0],p.position[2],1.1,.9)),
  ...s.trucks.filter(t=>t.siteId===siteId&&t.id!==exclude&&!['in_transit','delivered'].includes(t.status)).map(t=>({...truckFootprint(t,t.id),previousPosition:t.updatedAt===s.seconds?t.previousPosition:t.position,previousHeading:t.updatedAt===s.seconds?t.previousHeading:t.heading})),
  ...s.forklifts.filter(f=>f.siteId===siteId&&f.id!==exclude).map(f=>({...forkliftFootprint(f,f.id),previousPosition:f.updatedAt===s.seconds?f.previousPosition:f.position,previousHeading:f.updatedAt===s.seconds?f.previousHeading:f.heading})),
 ];
}
export function sweptClear(from:Pose,to:Pose,shape:(p:Pose)=>Footprint,solid:Footprint[],contact:string[]=[],moving=false){
 const distance=Math.hypot(to.position[0]-from.position[0],to.position[2]-from.position[2]);
 const turn=angleDelta(from.heading,to.heading), steps=Math.max(1,Math.ceil(distance/.15),Math.ceil(Math.abs(turn)/.08));
 for(let i=0;i<=steps;i++){
  const a=i/steps, pose={position:[from.position[0]+(to.position[0]-from.position[0])*a,0,from.position[2]+(to.position[2]-from.position[2])*a] as Position,heading:from.heading+turn*a};
  const footprint=shape(pose);
  if(solid.some(o=>{
   let obstacle=o;
   if(moving && o.previousPosition){const p=o.previousPosition;obstacle={...o,position:[p[0]+(o.position[0]-p[0])*a,0,p[2]+(o.position[2]-p[2])*a],heading:(o.previousHeading??o.heading)+angleDelta(o.previousHeading??o.heading,o.heading)*a};}
   return contact.includes(o.id)?overlap({...footprint,half:[.57,.7],offset:0},obstacle,.02):overlap(footprint,obstacle);
  }))return false;
 }
 return true;
}
const headingStep=Math.PI/4;
const plannedRoutes=new Map<string,Pose[]>();
interface Node extends Pose {key:string;cost:number;rank:number;parent?:Node;dir:number;x:number;z:number}
function plan(start:Pose,destination:Position,solid:Footprint[],contact:string[]):Pose[]|undefined{
 if(!sweptClear({position:destination,heading:0},{position:destination,heading:0},forkliftFootprint,solid,contact))return;
 const cacheKey=JSON.stringify([start.position,start.heading,destination,solid.map(o=>[o.position,o.heading,o.half,o.offset,contact.includes(o.id)])]);
 const cached=plannedRoutes.get(cacheKey);
 if(cached && cached.every((p,i)=>sweptClear(i?cached[i-1]:start,p,forkliftFootprint,solid,contact)))return cached.slice();
 const heap:Node[]=[],best=new Map<string,number>(),valid=new Map<string,boolean>();
 const push=(n:Node)=>{heap.push(n);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p].rank<=n.rank)break;heap[i]=heap[p];i=p;}heap[i]=n;};
 const pop=()=>{const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].rank<heap[child].rank)child++;if(heap[child].rank>=last.rank)break;heap[i]=heap[child];i=child;}heap[i]=last;}return first;};
 const make=(x:number,z:number,dir:number,cost:number,parent?:Node):Node=>({x,z,dir,key:x+':'+z+':'+dir,position:[x/2,0,z/2],heading:dir*headingStep,cost,rank:cost+Math.hypot(x/2-destination[0],z/2-destination[2])*1.5,parent});
 const dir=(Math.round(start.heading/headingStep)%8+8)%8;
 for(const x of new Set([Math.floor(start.position[0]*2),Math.ceil(start.position[0]*2)]))for(const z of new Set([Math.floor(start.position[2]*2),Math.ceil(start.position[2]*2)])){
  const first=make(x,z,dir,Math.hypot(x/2-start.position[0],z/2-start.position[2]));
  if(sweptClear(start,first,forkliftFootprint,solid,contact)){push(first);best.set(first.key,first.cost);}
 }
 for(let visits=0;heap.length&&visits<16000;visits++){
  const n=pop();if(n.cost!==best.get(n.key))continue;
  if(n.dir===0&&Math.hypot(n.position[0]-destination[0],n.position[2]-destination[2])<.4){
   const goal:Pose={position:[...destination],heading:0};
   if(sweptClear(n,goal,forkliftFootprint,solid,contact)){
    const result:Pose[]=[goal];for(let p:Node|undefined=n;p;p=p.parent)result.push({position:p.position,heading:p.heading});const path=result.reverse();
    const simplified=path.filter((p,i)=>!i||i===path.length-1||Math.abs(angleDelta(path[i-1].heading,p.heading))>.001||Math.abs(angleDelta(p.heading,path[i+1].heading))>.001||Math.abs((p.position[0]-path[i-1].position[0])*(path[i+1].position[2]-p.position[2])-(p.position[2]-path[i-1].position[2])*(path[i+1].position[0]-p.position[0]))>.001);
    if(plannedRoutes.size>=256)plannedRoutes.delete(plannedRoutes.keys().next().value!);
    plannedRoutes.set(cacheKey,simplified);return simplified.slice();
   }
  }
  const dx=Math.round(Math.sin(n.heading)),dz=Math.round(Math.cos(n.heading));
  for(const [x,z,dir,cost]of [[n.x,n.z,(n.dir+1)%8,.48],[n.x,n.z,(n.dir+7)%8,.48],[n.x+dx,n.z+dz,n.dir,Math.hypot(dx,dz)*.5],[n.x-dx,n.z-dz,n.dir,Math.hypot(dx,dz)*.65]]){
   if(x< -92||x>92||z< -22||z>35)continue;
   const next=make(x,z,dir,n.cost+cost,n);
   if((best.get(next.key)??Infinity)<=next.cost)continue;
   if(!valid.has(next.key))valid.set(next.key,sweptClear(next,next,forkliftFootprint,solid,contact));
   if(!valid.get(next.key)||!sweptClear(n,next,forkliftFootprint,solid,contact))continue;
   best.set(next.key,next.cost);push(next);
  }
 }
}
export function driveForklift(f:Simulation['forklifts'][number],destination:Position,s:Simulation,pickupId?:string){
 const solid=obstacles(s,f.siteId,f.id);
 const last=solid.find(o=>o.id===f.forkContact);if(!last||!overlap(forkliftFootprint(f),last))f.forkContact=undefined;
 const contact=[pickupId,f.forkContact].filter((id):id is string=>!!id);
 const key=destination.join(',')+':'+(pickupId??'');
 if(f.pathTarget!==key){f.path=undefined;f.pathTarget=key;f.waitTicks=0;}
 if(!f.path){
  if(f.waitTicks){f.waitTicks--;f.speed=0;return false;}
  f.path=plan(f,destination,solid,contact);
  if(!f.path){f.waitTicks=12;f.speed=0;return false;}
 }
 while(f.path.length&&Math.hypot(f.path[0].position[0]-f.position[0],f.path[0].position[2]-f.position[2])<.005&&Math.abs(angleDelta(f.heading,f.path[0].heading))<.005)f.path.shift();
 if(!f.path.length){f.speed=0;return true;}
 const target=f.path[0],turn=angleDelta(f.heading,target.heading),distance=Math.hypot(target.position[0]-f.position[0],target.position[2]-f.position[2]);
 const next:Pose={position:[...f.position],heading:f.heading+Math.max(-.3,Math.min(.3,turn))};
 const speed=Math.min(.6,f.speed+.08,distance);
 if(Math.abs(turn)<.005&&distance){next.position=[f.position[0]+(target.position[0]-f.position[0])*speed/distance,0,f.position[2]+(target.position[2]-f.position[2])*speed/distance];}
 if(!sweptClear(f,next,forkliftFootprint,solid,contact,true)){
  f.speed=0;f.waitTicks=(f.waitTicks??0)+1;if(f.waitTicks>=4){f.path=undefined;f.waitTicks=0;}return false;
 }
 f.speed=Math.hypot(next.position[0]-f.position[0],next.position[2]-f.position[2]);Object.assign(f,next);f.updatedAt=s.seconds;f.waitTicks=0;
 return false;
}
