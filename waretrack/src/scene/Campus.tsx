import { memo } from 'react';
import { Instances, Instance } from '@react-three/drei';
import { useWarehouse } from '../data/store';
import { sites } from '../data/seed';
import type { Position, Site } from '../data/model';
import { Block, Label } from './Primitives';
import { siteOrigins } from './layout';
import { ScreenLabel } from './ScreenLabel';
const roofs = ['#215cc9','#3370d6','#2863ca'];
function Shed({ position, width, depth, index, site }: { position: Position; width: number; depth: number; index: number; site: Site }) {
 const roof = useWarehouse(s => s.roof), active = useWarehouse(s => s.siteId === site.id);
 const select = useWarehouse(s => s.select);
 const count = Math.floor(width / 4);
 return <group position={position} onClick={e => { e.stopPropagation(); select({ kind:'site',id:site.id }); }} onPointerOver={e => { e.stopPropagation();document.body.style.cursor='pointer'; }} onPointerOut={() => {document.body.style.cursor='auto';}}>
  <Block position={[0,.12,0]} size={[width+.8,.24,depth+.8]} color="#e3e9f3"/>
  <Block position={[0,2.7,-depth/2]} size={[width,5.4,.2]} color="#e0e7f3"/>
  {[-1,1].map(x => <Block key={x} position={[x*width/2,2.7,0]} size={[.2,5.4,depth]} color="#f2f5fb"/>)}
  <Block position={[0,4.6,depth/2]} size={[width,1.6,.2]} color="#f4f6fc"/>
  <Block position={[0,3.8,depth/2+.1]} size={[width,.18,.15]} color="#2659a6"/>
  {roof && <><Block position={[0,5.8,-depth/4]} rotation={[-.11,0,0]} size={[width+1,.18,depth/2+.15]} color={site.kind==='cold_store'?'#e0e9f8':roofs[index%3]}/><Block position={[0,5.8,depth/4]} rotation={[.11,0,0]} size={[width+1,.18,depth/2+.15]} color={site.kind==='cold_store'?'#eaf0fa':roofs[index%3]}/></>}
  {Array.from({length:count},(_,i) => {const x=-width/2+2+i*4;return <group key={i}><Block position={[x,1.8,depth/2]} size={[2.6,3.6,.28]} color="#4b6792"/><Block position={[x,1.8,depth/2+.16]} size={[2.2,3.1,.08]} color="#a4b7d2"/><Block position={[x-1.5,2,depth/2+.2]} size={[.12,4,.2]} color="#f6f8fd"/><Block position={[x-1.55,.05,depth/2+4]} size={[.07,.02,7]} color="#cbb783"/><Block position={[x,.05,depth/2+7.5]} size={[3.1,.02,.07]} color="#cbb783"/>
   {roof && <Block position={[x,5.9,depth/4]} rotation={[.11,0,0]} size={[2.1,.06,1.8]} color="#a9c2e8"/>}</group>;})}
  <Label text={site.code + ' / ' + String.fromCharCode(66+index)} position={[0,4.8,depth/2+.3]} width={4} color="#436ca6"/>
  {active && <Block position={[0,2,-depth/2+.1]} size={[width-1,4,.12]} color="#eff4fc"/>}
 </group>;
}
function Containers({site}: {site:Site}) {
 const select=useWarehouse(s=>s.select);
 return <group onClick={e=>{e.stopPropagation();select({kind:'site',id:site.id});}}>
 <Instances limit={18} castShadow receiveShadow><boxGeometry args={[5.5,2.3,2.5]}/><meshStandardMaterial roughness={.9}/>
 {Array.from({length:12},(_,i)=><Instance key={i} position={[-39+(i%3)*6.2,1.2+Math.floor(i/6)*2.4,9+Math.floor(i%6/3)*3]} color={i%3===0?'#6bada8':i%3===1?'#6689bd':'#dee7f4'}/>)}</Instances>
 <Instances limit={160} castShadow><boxGeometry args={[.04,2.15,.05]}/><meshStandardMaterial color="#91a9c5"/>{Array.from({length:144},(_,i)=>{const box=Math.floor(i/12),rib=i%12;return <Instance key={i} position={[-41.5+(box%3)*6.2+rib*.44,1.2+Math.floor(box/6)*2.4,10.28+Math.floor(box%6/3)*3]}/>;})}</Instances>
 </group>;
}
function LocalCampus({site, active}:{site:Site;active:boolean}) {
 const select=useWarehouse(s=>s.select), labels=useWarehouse(s=>s.labels);
 if (!active) return <group position={siteOrigins[site.id]} onClick={e=>{e.stopPropagation();select({kind:'site',id:site.id});}}>
  <Block position={[0,-.08,-6]} size={[94,.12,78]} color="#f1f3fa"/>
  <Block position={[0,2.7,-5]} size={[46,5.4,26]} color="#eef2fa"/><Block position={[0,5.6,-5]} size={[47,.25,27]} color={site.kind==='cold_store'?'#dfe8f6':'#3a71cc'}/>
  <Block position={[-30,2,-17]} size={[17,4,24]} color="#dce5f3"/>
  <ScreenLabel position={[0,8,-5]} title={site.code+' · '+site.name} subtitle="BẤM ĐỂ CHUYỂN KHO" visible={labels}/>
 </group>;
 return <group position={siteOrigins[site.id]}>
  <Block position={[0,-.08,-6]} size={[94,.12,78]} color="#f1f3fa"/>
  <Shed site={site} position={[-29,0,-22]} width={24} depth={18} index={0}/>
  <Shed site={site} position={[2,0,-32]} width={29} depth={17} index={1}/>
  <Shed site={site} position={[32,0,-14]} width={18} depth={29} index={2}/>
  {!active && <Shed site={site} position={[0,0,-4]} width={21} depth={12} index={1}/>}
  <Containers site={site}/>
  <group position={[-32,0,27]} onClick={e=>{e.stopPropagation();select({kind:'site',id:site.id});}}>
   <Block position={[0,3,0]} size={[17,6,8]} color="#eef3fb"/><Block position={[0,6.15,0]} size={[17.5,.3,8.5]} color="#d6e2f3"/>
   {[-6,-2,2,6].flatMap(x=>[1.7,4.2].map(y=><group key={x+':'+y}><Block position={[x,y,4.05]} size={[2.7,1.6,.08]} color="#a9c5df"/><Block position={[x,y,4.12]} size={[.07,1.6,.04]} color="#edf6ff"/></group>))}
   <Block position={[0,1.5,4.1]} size={[1.5,3,.12]} color="#6690c0"/>
   <Label text="KHOSPACE / OPERATIONS" position={[0,6.8,0]} width={6}/>
  </group>
  {[-1,1].map(x=><group key={x}><Block position={[x*47,.04,-6]} size={[1.4,.1,78]} color="#dbe4df"/>
   {Array.from({length:15},(_,i)=>i===10 || i===11 ? null : <group key={i} position={[x*47,0,-44+i*5.5]}><Block position={[0,1.1,0]} size={[.07,2.2,.07]} color="#b9c7d9"/><Block position={[0,1.7,2.75]} size={[.035,.035,5.5]} color="#b9c7d9"/><Block position={[0,.8,2.75]} size={[.035,.035,5.5]} color="#c5d0e0"/></group>)}</group>)}
  <Block position={[6,.05,28]} size={[52,.06,11]} color="#e1e7f2"/>
  {Array.from({length:15},(_,i)=><Block key={i} position={[-18+i*3.5,.1,28]} size={[.06,.02,9]} color="#fafbfe"/>)}
  <ScreenLabel position={[28,8,-24]} title={site.code+' · '+site.name} subtitle={active?'CAMPUS ĐANG VẬN HÀNH':'BẤM ĐỂ CHUYỂN KHO'} visible={labels}/>
 </group>;
}
export default memo(function Campus() {
 const active=useWarehouse(s=>s.siteId);
 return <>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.18,0]} receiveShadow><planeGeometry args={[650,650]}/><meshStandardMaterial color="#e8ecf6" roughness={1}/></mesh>
  {[-45,45,-135,135].map(z=><group key={z}><Block position={[0,-.025,z]} size={[380,.04,9]} color="#d1d9eb"/><Block position={[0,.015,z-4.7]} size={[380,.1,.35]} color="#f7f9ff"/><Block position={[0,.015,z+4.7]} size={[380,.1,.35]} color="#f7f9ff"/>
   <Instances limit={100}><boxGeometry args={[2,.02,.1]}/><meshStandardMaterial color="#fafbff"/>{Array.from({length:90},(_,i)=><Instance key={i} position={[-185+i*4.2,.01,z]}/>)}</Instances></group>)}
  {[-52.5,52.5,-157.5,157.5].map(x=><group key={x}><Block position={[x,-.02,0]} size={[8,.04,320]} color="#d1d9eb"/><Instances limit={80}><boxGeometry args={[.1,.02,2]}/><meshStandardMaterial color="#fafbff"/>{Array.from({length:70},(_,i)=><Instance key={i} position={[x,.01,-145+i*4.2]}/>)}</Instances></group>)}
  {sites.map(site=><LocalCampus key={site.id} site={site} active={site.id===active}/>)}
  <Instances limit={160} castShadow><icosahedronGeometry args={[1.3,1]}/><meshStandardMaterial color="#9fbea9" flatShading/>{sites.flatMap(site=>Array.from({length:28},(_,i)=><Instance key={site.id+i} position={[siteOrigins[site.id][0]-44+(i%14)*6.7,2.1,siteOrigins[site.id][2]+(i<14?-43:36)]} scale={[1,1.2,1]}/>))}</Instances>
 </>;
});
