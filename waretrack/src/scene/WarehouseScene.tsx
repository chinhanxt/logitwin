import { Component, memo, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MOUSE, Object3D, OrthographicCamera, Vector3 } from 'three';
import type { OrbitControls as Controls } from 'three-stdlib';
import { findEntity, useWarehouse } from '../data/store';
import { SiteGround, WarehouseBuilding } from './Building';
import { ForkliftModel, TruckModel } from './Vehicles';
import { ChargerModel, PalletModel, SelectedRoute } from './Entities';
import Campus from './Campus';
import { BlockInstances } from './Primitives';
import { siteOrigins, districtBounds } from './layout';
import { CargoBoxes, SiteFeatures } from './Environment';
const initial = new Vector3(38,31,43);
function CameraRig() {
 const controls = useRef<Controls>(null), { camera, size } = useThree();
 const command = useWarehouse(s => s.cameraCommand), siteId = useWarehouse(s => s.siteId), quality = useWarehouse(s => s.quality);
 const { setDpr } = useThree(), frames = useRef({ elapsed: 0, count: 0, lowered: false });
 const goal = useRef<{ position: Vector3; target: Vector3; zoom: number } | null>(null);
 const baseZoom = size.width < 600 ? size.width / 49 : size.width < 1100 ? Math.min(size.width / 48, size.height / 48) : Math.min((size.width - 160) / 48, size.height / 34);
 useEffect(() => {
  const cam = camera as OrthographicCamera; cam.zoom = baseZoom;
  cam.setViewOffset(size.width,size.height,0,-15,size.width,size.height);
  cam.updateProjectionMatrix();
 }, [camera,size,baseZoom]);
 useEffect(() => {
  setDpr(quality === 'low' ? 1 : Math.min(devicePixelRatio,1.5));
  frames.current = { elapsed: 0, count: 0, lowered: quality === 'low' };
 }, [quality,setDpr]);
 useEffect(() => {
  const cam = camera as OrthographicCamera, ctl = controls.current;
  const target = ctl?.target.clone() ?? new Vector3(0,0,1);
  const offset = camera.position.clone().sub(target);
  const origin = new Vector3(...siteOrigins[siteId]);
  if (command.action === 'in' || command.action === 'out') {
   goal.current = { position: camera.position.clone(), target, zoom: Math.max(2,Math.min(100,cam.zoom * (command.action === 'in' ? 1.2 : 1/1.2))) };
  } else if (command.action === 'left' || command.action === 'right') {
   offset.applyAxisAngle(new Vector3(0,1,0), command.action === 'left' ? Math.PI/2 : -Math.PI/2);
   goal.current = { position: target.clone().add(offset), target, zoom: cam.zoom };
  } else if (command.action === 'focus') {
   const s = useWarehouse.getState(), entity = s.selection ? findEntity(s,s.selection) : undefined;
   const focus = entity && 'position' in entity ? new Vector3(...entity.position).add(origin) : origin.clone().add(new Vector3(0,0,1));
   goal.current = { position: focus.clone().add(offset), target: focus, zoom: cam.zoom };
  } else goal.current = { position: command.action === 'top' ? new Vector3(0,60,1.1).add(origin) : initial.clone().add(origin), target: origin.clone().add(new Vector3(0,0,1)), zoom: baseZoom };
 }, [command,camera,siteId,baseZoom]);
 useFrame((_,delta) => {
  const ctl = controls.current; if (!ctl) return;
  const stats = frames.current; stats.elapsed += delta; stats.count++;
  if (stats.elapsed > 5 && !stats.lowered && stats.count / stats.elapsed < 32) { stats.lowered = true; setDpr(1); }
  if (goal.current) {
   const alpha = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1-Math.exp(-delta*5);
   camera.position.lerp(goal.current.position,alpha); ctl.target.lerp(goal.current.target,alpha);
   const cam = camera as OrthographicCamera; cam.zoom += (goal.current.zoom-cam.zoom)*alpha; cam.updateProjectionMatrix();
   if (camera.position.distanceTo(goal.current.position)<.01 && Math.abs(cam.zoom-goal.current.zoom)<.01) goal.current = null;
  }
  ctl.target.clamp(new Vector3(districtBounds.min,0,districtBounds.min),new Vector3(districtBounds.max,1,districtBounds.max)); ctl.update();
 });
 return <OrbitControls ref={controls} makeDefault target={[0,0,1]} minZoom={2} maxZoom={100} minPolarAngle={.03} maxPolarAngle={Math.PI/2.55} enableDamping dampingFactor={.09} mouseButtons={{LEFT:MOUSE.PAN,MIDDLE:MOUSE.DOLLY,RIGHT:MOUSE.ROTATE}} onStart={() => { goal.current = null; }}/>;
}
function World() {
 const siteId = useWarehouse(s => s.siteId), trucks = useWarehouse(s => s.trucks), forklifts = useWarehouse(s => s.forklifts), pallets = useWarehouse(s => s.pallets), chargers = useWarehouse(s => s.chargers);
 const roof = useWarehouse(s => s.roof), quality = useWarehouse(s => s.quality);
 const origin = siteOrigins[siteId];
 const sunTarget = useMemo(() => { const target = new Object3D(); target.position.set(...siteOrigins[siteId]); return target; },[siteId]);
 return <>
  <color attach="background" args={['#e9edf7']}/><fog attach="fog" args={['#e9edf7',250,520]}/>
  <ambientLight intensity={1.35}/><hemisphereLight args={['#f6f7ff','#b2b9d3',1.3]}/>
  <directionalLight position={[origin[0]-16,40,origin[2]+18]} target={sunTarget} intensity={2.7} castShadow={quality !== 'low'} shadow-mapSize={[1024,1024]} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-normalBias={.04} shadow-bias={-.0001} shadow-radius={4}/>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.82,0]} receiveShadow><planeGeometry args={[250,250]}/><meshStandardMaterial color="#e9edf7" roughness={1}/></mesh>
  <primitive object={sunTarget}/><BlockInstances><Campus/>
  <group key={'static-'+siteId} position={origin}><SiteGround/><WarehouseBuilding/><SiteFeatures/>{!roof && <CargoBoxes/>}
  {chargers.filter(c => c.siteId === siteId).map(c => <ChargerModel key={c.id} charger={c}/>)}</group></BlockInstances>
  <group key={siteId} position={origin}>
  {trucks.filter(t => t.siteId === siteId).map(t => <TruckModel key={t.id} truck={t}/>)}
  {forklifts.filter(f => f.siteId === siteId).map(f => <ForkliftModel key={f.id} forklift={f}/>)}
  {pallets.filter(p => p.siteId === siteId).map(p => <PalletModel key={p.id} pallet={p}/>)}
  <SelectedRoute/></group><CameraRig/>
 </>;
}
class SceneBoundary extends Component<{children: ReactNode},{failed:boolean}> {
 state = {failed:false};
 static getDerivedStateFromError() { return {failed:true}; }
 componentDidCatch(error:Error) { console.error('[KhoSpace] 3D scene error',error); }
 render() { return this.state.failed ? <div className="scene-fallback"><strong>Không thể khởi tạo cảnh 3D</strong><p>Bật tăng tốc đồ họa trong trình duyệt rồi tải lại. Các bảng dữ liệu và tìm kiếm vẫn sử dụng được.</p><button onClick={() => location.reload()}>Tải lại</button></div> : this.props.children; }
}
export default memo(function WarehouseScene() {
 const [ready,setReady] = useState(false);
 return <SceneBoundary><div className="scene-canvas" data-testid="warehouse-scene" data-ready={ready}>
 {!ready && <div className="scene-loading"><span className="loader"/>Đang dựng không gian kho…</div>}
 <Canvas shadows="soft" orthographic camera={{position:[38,31,43],zoom:17,near:.1,far:800}} dpr={[1,1.5]} gl={{antialias:true,alpha:false}} onCreated={() => setReady(true)} onPointerMissed={() => useWarehouse.getState().select(null)} fallback={<div className="scene-fallback">WebGL chưa sẵn sàng. Bạn vẫn có thể chọn đối tượng từ bảng điều phối và tìm kiếm.</div>}><World/></Canvas>
 </div></SceneBoundary>;
});
