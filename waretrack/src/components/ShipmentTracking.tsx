import { IconArrowUpRight, IconCheck, IconPackage, IconTruck } from '@tabler/icons-react';
import { useWarehouse } from '../data/store';
import { sites } from '../data/seed';
import { formatTime, remainingSeconds } from '../sim/engine';
import { Badge } from './Inspector';
export default function ShipmentTracking({ onExpand }: { onExpand: () => void }) {
 const s = useWarehouse(), t = s.trucks.find(t => t.id === s.trackedTruckId), sh = s.shipments.find(sh => sh.truckId === t?.id);
 if (!t || !sh) return <section className="shipment-tracking glass empty-state">Chọn xe để theo dõi lô hàng.</section>;
 const site = sites.find(site => site.id === t.siteId)!;
 const current = t.status === 'delivered' ? 4 : ['departing','in_transit'].includes(t.status) ? 3 : ['loading','unloading'].includes(t.status) ? 2 : 1;
 const labels = ['Xác nhận đơn', 'Đã soạn hàng', t.inbound ? 'Dỡ hàng' : t.progress >= 100 ? 'Đã xếp hàng' : 'Xếp hàng', 'Đang giao', 'Đã giao'];
 return <section className="shipment-tracking glass" aria-label="Hành trình lô hàng"><div className="tracking-main"><div className="section-title"><h3><IconPackage size={16}/>Hành trình lô hàng</h3><span>{t.name} · {site.code}</span></div>
  <ol className="timeline-steps">{labels.map((label, i) => <li className={'timeline-step ' + (i < current ? 'done' : i === current ? 'current' : '')} key={i}><span className="step-node">{i < current ? <IconCheck size={14}/> : i === 3 ? <IconTruck size={14}/> : i === 4 ? <IconCheck size={14}/> : <IconPackage size={14}/>}</span><strong>{label}</strong><small>{i === 2 && current === 2 ? Math.floor((t.progress + .000001) * 6 / 100) + '/6 pallet' : sh.steps[i].at !== undefined ? formatTime(sh.steps[i].at!) : 'ETA ' + sh.eta}</small></li>)}</ol>
 </div><button className="shipment-card" onClick={() => s.select({ kind: 'truck', id: t.id })}><span className="shipment-truck"><IconTruck size={42} stroke={1.2}/></span><span><strong>#{sh.id}</strong><small>Đến: {sh.destination}</small><Badge status={t.status}/><small>{site.code} · {s.docks.find(d => d.id === t.dockId)?.name ?? 'Đường vận chuyển'} · {Math.ceil(remainingSeconds(t) / 60)} phút</small></span><IconArrowUpRight size={16}/></button><button className="tracking-expand" onClick={onExpand} aria-label="Tất cả lô hàng"><IconArrowUpRight size={15}/></button></section>;
}
