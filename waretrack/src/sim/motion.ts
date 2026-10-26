import { CubicBezierCurve3, CurvePath, LineCurve3, Vector3 } from 'three';
import type { Forklift, Position, Simulation, Truck } from '../data/model';
export interface Pose { position: Position; heading: number }
export const travelSeconds = { en_route: 180, docking: 120, departing: 90 };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const p=clamp(n); return p*p*(3-2*p); };
export const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to-from),Math.cos(to-from));
export const gatePosition = (slot: number): Position => [16+slot*7,0,15.5];
export function yardPosition(p: {id: string}): Position {
 const index=Number(p.id.split('-p')[1])-1;
 const incoming=Math.floor(index/6)%2===1, column=index%6, row=Math.floor(index/12);
 return [incoming?22+column*3:-37+column*3,0,(incoming?4:0)+row*4];
}
const routes = new Map<string, CurvePath<Vector3>>();
function route(key: string, points: Position[], curved: boolean) {
 let path=routes.get(key);
 if (!path) {
  path=new CurvePath<Vector3>();
  const p=points.map(p=>new Vector3(...p));
  if (curved) path.add(new CubicBezierCurve3(p[0],p[1],p[2],p[3]));
  else for(let i=1;i<p.length;i++)path.add(new LineCurve3(p[i-1],p[i]));
  routes.set(key,path);
 }
 return path;
}
function sample(path: CurvePath<Vector3>, progress: number, reverse=false): Pose {
 const p=clamp(progress), at=path.getPointAt(p), tangent=path.getTangentAt(p);
 return {position:[at.x,at.y,at.z],heading:Math.atan2(tangent.x,tangent.z)+(reverse?Math.PI:0)};
}
export function truckPose(t: Truck, s: Pick<Simulation,'docks'>, elapsed=t.elapsed): Pose {
 const gate=gatePosition(t.gateSlot);
 const dock=s.docks.find(d=>d.id===t.dockId);
 const x=dock?.position[0] ?? t.position[0];
 if(t.status==='en_route')return sample(route('entry:'+t.gateSlot,[[58,0,15.5],gate],false),ease(elapsed/travelSeconds.en_route));
 if(t.status==='at_gate')return {position:gate,heading:-Math.PI/2};
 if(t.status==='docking') {
  const p=clamp(elapsed/travelSeconds.docking), pivot:Position=[x-5,0,15.5];
  if(p<=.45)return sample(route('approach:'+t.gateSlot+':'+x,[gate,pivot],false),ease(p/.45));
  if(p<.5)return {position:pivot,heading:-Math.PI/2};
  return sample(route('reverse:'+x,[pivot,[x+1,0,15.5],[x,0,10],[x,0,4.5]],true),ease((p-.5)/.5),true);
 }
 if(t.status==='loading'||t.status==='unloading')return {position:[x,0,4.5],heading:0};
 if(t.status==='departing') {
  const key='exit:'+x;
  let path=routes.get(key);
  if(!path){path=new CurvePath<Vector3>();path.add(new CubicBezierCurve3(new Vector3(x,0,4.5),new Vector3(x,0,12.2),new Vector3(x+4,0,12.2),new Vector3(x+9,0,12.2)));path.add(new LineCurve3(new Vector3(x+9,0,12.2),new Vector3(58,0,12.2)));routes.set(key,path);}
  return sample(path,ease(elapsed/travelSeconds.departing));
 }
 return {position:[58,0,12.2],heading:Math.PI/2};
}
export function truckRoute(t: Truck, s: Pick<Simulation,'docks'>): Position[] {
 if(t.status==='at_gate')return [gatePosition(t.gateSlot)];
 const duration=travelSeconds[t.status as keyof typeof travelSeconds];
 if(!duration)return [];
 return Array.from({length:49},(_,i)=>truckPose(t,s,t.elapsed+(duration-t.elapsed)*i/48).position);
}
export function forkPosition(f: Pick<Forklift,'position'|'heading'>): Position {
 return [f.position[0]+Math.sin(f.heading)*1.2,.32,f.position[2]+Math.cos(f.heading)*1.2];
}
