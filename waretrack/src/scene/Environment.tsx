import { Instances, Instance } from '@react-three/drei';
import { Block } from './Primitives';
import { useWarehouse } from '../data/store';
import { sites } from '../data/seed';
const trees = [
 ...[-18.8,19.6].flatMap(x => [-11,-6,-.8,4.5,9].map(z => [x,0,z])),
 ...[-16,-10,-4,2,8,14].flatMap(x => [[x,0,-13.6],[x,0,18]]),
];
export function Trees() {
 return <><Instances limit={30} castShadow><cylinderGeometry args={[.1,.13,1.5,6]}/><meshStandardMaterial color="#a99c91"/>{trees.map(([x,y,z],i) => <Instance key={i} position={[x,y+.75,z]}/>)}</Instances>
 <Instances limit={30} castShadow><icosahedronGeometry args={[1,1]}/><meshStandardMaterial color="#a7c3b4" flatShading/>{trees.map(([x,y,z],i) => <Instance key={i} position={[x,y+2,z]} scale={[.85,1.15,.85]} color={i%2 ? '#a8c7b5' : '#8db4a0'}/>)}</Instances></>;
}
export function CargoBoxes() {
 return <Instances limit={100} castShadow receiveShadow><boxGeometry args={[.66,.6,.65]}/><meshStandardMaterial color="#d7b68d" roughness={1}/>
  {Array.from({length:64},(_,i) => <Instance key={i} position={[-7.5+(i%8)*2.1,.65+Math.floor(i/32)*1.4,-8+Math.floor(i%32/8)*1.5]} color={i%3 ? '#d7b68d' : '#c5a27d'}/>)}</Instances>;
}
export function SiteFeatures() {
 const id = useWarehouse(s => s.siteId), roof = useWarehouse(s => s.roof), site = sites.find(s => s.id === id)!;
 return <group>
  {site.kind === 'cold_store' && <>{roof && [-6,-2,2,6].map(x => <group key={x} position={[x,5.1,-4]}><Block size={[2.3,.6,2.1]} color="#e6edf6"/><mesh position={[0,.34,0]} rotation={[-Math.PI/2,0,0]}><cylinderGeometry args={[.7,.7,.07,16]}/><meshStandardMaterial color="#7389a8"/></mesh>{[0,1,2,3].map(n => <Block key={n} position={[0,.4,0]} rotation={[0,n*Math.PI/4,0]} size={[1.2,.04,.12]} color="#c7d5e8"/>)}</group>)}
  {[0,3].map(z => <group key={z} position={[-13,0,z-9]}><mesh position={[0,2,0]} castShadow><cylinderGeometry args={[1.15,1.15,4,16]}/><meshStandardMaterial color="#fafbfe"/></mesh><mesh position={[0,4.25,0]} castShadow><coneGeometry args={[1.15,.5,16]}/><meshStandardMaterial color="#e3eaf4"/></mesh></group>)}</>}
  {site.kind === 'automated_dc' && <>{[-8,-4,0,4,8].map(x => <group key={x}><Block position={[x,3.9,1.95]} size={[2.8,1.3,.12]} color="#9fbfdf"/><Block position={[x,3.9,2.03]} size={[.05,1.3,.08]} color="#eff7ff"/></group>)}<Block position={[0,5.7,-4]} size={[20.5,.3,12]} color="#f5f9ff"/></>}
  {site.kind === 'distribution_center' && <>{[-5,0,5].map(x => <group key={x}><Block position={[x,2,-11.6]} size={[4.7,4,3.7]} color="#eef3fa"/><Block position={[x,4.1,-11.6]} size={[4.8,.2,3.8]} color="#205fce"/></group>)}</>}
  {site.kind === 'cross_dock' && <>{[-8.25,-4.95,-1.65,1.65,4.95,8.25].map(x => <Block key={x} position={[x,.08,10]} size={[2.5,.025,.08]} color="#d4b780"/>)}<Block position={[0,3.7,2.6]} size={[21,.15,2.2]} color="#2f67c6"/></>}
  {site.kind === 'depot' && <>{[-6.9,0,6.9].map(x => <Block key={x} position={[x,5.7,-4]} size={[.09,.05,12]} color="#94b6f0"/>)}</>}
 </group>;
}
