import { useState } from 'react';
import { IconArrowUpRight, IconBattery3, IconBuildingWarehouse, IconTruck } from '@tabler/icons-react';
import { useWarehouse, getMetrics } from '../data/store';
import { sites } from '../data/seed';
import { forkliftLabel } from '../data/model';
import { remainingSeconds, isDocked } from '../sim/engine';
import { Badge } from './Inspector';
import { Chip, Progress } from './Ui';
export default function FleetBoard() {
 const s = useWarehouse(), site = sites.find(site => site.id === s.siteId)!, m = getMetrics(s, s.siteId);
 const [tab, setTab] = useState<'docks' | 'forklifts' | 'trucks'>('docks');
 const trucks = s.trucks.filter(t => t.siteId === s.siteId), forklifts = s.forklifts.filter(f => f.siteId === s.siteId);
 return <section className="fleet-board glass" aria-label="Bảng điều phối"><div className="fleet-heading"><div role="tablist" aria-label="Đội vận hành">{(['docks','forklifts','trucks'] as const).map((t, i) => <button key={t} role="tab" aria-selected={tab === t} aria-controls="fleet-content" id={'tab-' + t} onClick={() => setTab(t)}>{['Cửa kho','Xe nâng','Xe tải'][i]}<span>{[m.busyDocks + '/' + m.totalDocks, forklifts.filter(f => f.active).length + '/' + forklifts.length, trucks.length][i]}</span></button>)}</div><small>{site.code}</small></div>
 <div className="fleet-rows" id="fleet-content" role="tabpanel" aria-labelledby={'tab-' + tab} key={tab + site.id}>
 {tab === 'docks' && <>{s.docks.filter(d => d.siteId === s.siteId).map(d => { const t = trucks.find(t => t.dockId === d.id && isDocked(t)); return <button className={'fleet-row ' + (s.selection?.id === d.id ? 'selected' : '')} key={d.id} onClick={() => s.select({ kind: 'dock', id: d.id })}><span className="row-symbol"><IconBuildingWarehouse size={19}/></span><span className="fleet-identity"><strong>{d.name}<small> · {d.direction === 'in' ? 'Nhập' : 'Xuất'}</small></strong><small>{t ? t.name + ' · ' + t.carrier : 'Chưa phân xe'}</small></span>{t ? <Badge status={t.status}/> : <Chip tone="gray">Trống</Chip>}<span className="row-end">{t ? Math.floor((t.progress + .000001) * 6 / 100) + '/6' : '—'}</span></button>; })}
 {trucks.filter(t => t.status === 'en_route' || t.status === 'at_gate').map(t => <button className="fleet-row" key={t.id} onClick={() => s.select({ kind: 'truck', id: t.id })}><span className="row-symbol"><IconTruck size={19}/></span><span className="fleet-identity"><strong>{t.name}</strong><small>{t.carrier}</small></span><Badge status={t.status}/><span className="row-end">{t.status === 'at_gate' ? 'Chờ' : Math.ceil(remainingSeconds(t) / 60) + 'p'}</span></button>)}</>}
 {tab === 'forklifts' && forklifts.map(f => <button key={f.id} className={'fleet-row ' + (s.selection?.id === f.id ? 'selected' : '')} onClick={() => s.select({ kind: 'forklift', id: f.id })}><span className="row-symbol"><IconBattery3 size={19}/></span><span className="fleet-identity"><strong>{f.name}</strong><small>{s.trucks.find(t => t.id === f.truckId)?.name ?? f.model}</small><Progress value={f.battery} green/></span><Chip tone={f.status === 'charging' ? 'orange' : 'green'}>{forkliftLabel[f.status]}</Chip><span className="row-end">{Math.round(f.battery)}%</span></button>)}
 {tab === 'trucks' && trucks.map(t => <button key={t.id} className={'fleet-row ' + (s.selection?.id === t.id ? 'selected' : '')} onClick={() => s.select({ kind: 'truck', id: t.id })}><span className="row-symbol" style={{ color: t.color }}><IconTruck size={20}/></span><span className="fleet-identity"><strong>{t.name}</strong><small>{t.carrier}</small></span><Badge status={t.status}/><IconArrowUpRight size={14}/></button>)}
 </div><div className="fleet-footer"><i className="live-dot"/>{s.running ? 'Đang cập nhật trực tiếp' : 'Mô phỏng tạm dừng'}<span>{trucks.length} xe trong mạng lưới kho</span></div></section>;
}
