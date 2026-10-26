import { Line } from '@react-three/drei';
import { truckRoute } from '../sim/motion';
import { useWarehouse } from '../data/store';
import type { Pallet as PalletData, Charger, Selection } from '../data/model';
import { Block, Label, Pallet, SelectionRing } from './Primitives';
import { ScreenLabel } from './ScreenLabel';
export function useEntityEvents(selection: Selection) {
 const select = useWarehouse(s => s.select), hover = useWarehouse(s => s.hover);
 return {
  onClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); select(selection); },
  onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); hover(selection); document.body.style.cursor = 'pointer'; },
  onPointerOut: () => { hover(null); document.body.style.cursor = 'auto'; },
 };
}
export function Corners({ width = 2.3, depth = 5.2 }: { width?: number; depth?: number }) {
 return <group>{[-1,1].flatMap(x => [-1,1].map(z => <group key={x + ':' + z} position={[x * width / 2, .12, z * depth / 2]}><Block position={[-x * .23,0,0]} size={[.5,.035,.055]} color="#3474ed"/><Block position={[0,0,-z * .23]} size={[.055,.035,.5]} color="#3474ed"/></group>))}</group>;
}
export function PalletModel({ pallet: p, carried=false }: { pallet: PalletData; carried?: boolean }) {
 const active = useWarehouse(s => s.selection?.id === p.id || s.hovered?.id === p.id);
 const events = useEntityEvents({ kind: 'pallet', id: p.id });
 if (p.status === 'loaded' || (p.status === 'moving' && !carried)) return null;
 return <group name={p.id} position={carried ? [0,.32,1.2] : p.position} {...events}><Pallet position={[0,0,0]}/>{active && <SelectionRing radius={.9}/>}
  {p.status === 'staged' && <group position={[0,2.2,0]}><mesh rotation={[0,0,Math.PI]}><coneGeometry args={[.18,.4,6]}/><meshBasicMaterial color="#3b79f4"/></mesh><mesh position={[0,.25,0]}><sphereGeometry args={[.22,12,12]}/><meshBasicMaterial color="#3b79f4"/></mesh><mesh position={[0,.25,.21]}><circleGeometry args={[.08,12]}/><meshBasicMaterial color="white"/></mesh></group>}
  <ScreenLabel title={'PAL-' + p.id.toUpperCase()} subtitle={p.name} position={[0,2.9,0]} visible={active} variant="vehicle"/>
 </group>;
}
export function ChargerModel({ charger: c }: { charger: Charger }) {
 const active = useWarehouse(s => s.selection?.id === c.id || s.hovered?.id === c.id);
 const events = useEntityEvents({ kind: 'charger', id: c.id });
 return <group position={c.position} {...events}><Block position={[0,.04,0]} size={[1.8,.06,1.6]} color={active ? '#c0d6ff' : '#e3eaf5'}/><Block position={[0,.62,0]} size={[.65,1.2,.5]} color="#f9fbff"/><Block position={[0,1.28,0]} size={[.72,.12,.57]} color="#5e87d2"/><Block position={[0,.9,.27]} size={[.38,.28,.04]} color="#324d75"/><Block position={[0,.92,.3]} size={[.22,.1,.03]} color={c.forkliftId ? '#ebad45' : '#55b983'}/><Line points={[[.25,.95,.28],[.6,.7,.45],[.6,.18,.5],[.3,.14,.5]]} color="#4b5e7b" lineWidth={2}/>
  <Label text={c.name} position={[0,1.65,0]} width={.6}/>{active && <SelectionRing radius={1}/>}<ScreenLabel title={c.name + ' · 48 V'} subtitle={c.forkliftId ? 'Đang sạc xe nâng' : 'Sẵn sàng'} position={[0,2.1,0]} visible={active} variant="vehicle"/>
 </group>;
}
export function SelectedRoute() {
 const s = useWarehouse(), t = s.trucks.find(t => s.selection?.kind === 'truck' && t.id === s.selection.id);
 if (!t || !['en_route','at_gate','docking'].includes(t.status)) return null;
 const points=truckRoute(t,s).map(([x,,z])=>[x,.16,z] as [number,number,number]);
 if(points.length<2)return null;
 return <Line points={points} lineWidth={2} color="#3978ed" dashed={t.status==='docking'} dashSize={.35} gapSize={.2}/>;
}
