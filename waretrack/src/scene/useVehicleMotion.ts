import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Object3D } from 'three';
import type { Position } from '../data/model';
import { angleDelta } from '../sim/motion';
import { useWarehouse } from '../data/store';
import { playback } from '../sim/playback';
interface MovingPose {
 id: string; position: Position; previousPosition: Position; heading: number; previousHeading: number;
}
export function useVehicleMotion(entity: MovingPose, radius: number) {
 const pose=entity;
 const ref=useRef<Group>(null), initial=useRef({position:[...pose.position] as Position,rotation:[0,pose.heading,0] as Position});
 const wheels=useRef<Object3D[]>([]), mounted=useRef<Group | null>(null);
 useFrame(() => {
  const model=ref.current;if(!model)return;
  if(mounted.current!==model){mounted.current=model;wheels.current=model.getObjectsByProperty('name','wheel');}
  // Read the same snapshot as the clock, even before React commits its next render.
  const state=useWarehouse.getState();
  const pose=state.trucks.find(t=>t.id===entity.id) ?? state.forklifts.find(f=>f.id===entity.id) ?? entity;
  const alpha=playback.fraction, previous=pose.previousPosition;
  const x=previous[0]+(pose.position[0]-previous[0])*alpha, z=previous[2]+(pose.position[2]-previous[2])*alpha;
  const heading=pose.previousHeading+angleDelta(pose.previousHeading,pose.heading)*alpha;
  const distance=(x-model.position.x)*Math.sin(heading)+(z-model.position.z)*Math.cos(heading);
  model.position.set(x,pose.position[1],z);model.rotation.y=heading;
  for(const wheel of wheels.current)wheel.rotation.y+=distance/radius;
 },-1);
 return {ref,initial:initial.current};
}
