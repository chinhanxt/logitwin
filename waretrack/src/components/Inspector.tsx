import { useState } from 'react';
import { IconArrowUpRight, IconBattery3, IconBox, IconFocus2, IconMapPin, IconPackage, IconX } from '@tabler/icons-react';
import { useWarehouse, getMetrics } from '../data/store';
import { sites } from '../data/seed';
import { forkliftLabel, kindLabel, statusLabel } from '../data/model';
import type { VehicleStatus, Selection } from '../data/model';
import { formatTime, isDocked, remainingSeconds } from '../sim/engine';
import { Chip, Detail, Progress, Tile } from './Ui';
export function Badge({ status }: { status: VehicleStatus }) {
 return <Chip tone={['loading', 'unloading'].includes(status) ? 'green' : status === 'at_gate' ? 'orange' : status === 'delivered' ? 'gray' : 'blue'}>{statusLabel[status]}</Chip>;
}
export default function Inspector() {
 const s = useWarehouse(), { selection, select } = s, site = sites.find(site => site.id === s.siteId)!;
 const [expanded, setExpanded] = useState(false);
 const m = getMetrics(s, s.siteId);
 if (!selection) return <button className="restore-inspector glass" onClick={() => select({ kind: 'site', id: s.siteId })}><IconBox size={18}/>Thông tin kho<IconArrowUpRight size={16}/></button>;
 const truck = selection.kind === 'truck' ? s.trucks.find(t => t.id === selection.id) : undefined;
 const f = selection.kind === 'forklift' ? s.forklifts.find(t => t.id === selection.id) : undefined;
 const p = selection.kind === 'pallet' ? s.pallets.find(t => t.id === selection.id) : undefined;
 const c = selection.kind === 'charger' ? s.chargers.find(t => t.id === selection.id) : undefined;
 const dock = selection.kind === 'dock' ? s.docks.find(t => t.id === selection.id) : undefined;
 const item = selection.kind === 'inventory' ? s.inventory.find(t => t.id === selection.id) : undefined;
 const sh = s.shipments.find(sh => sh.truckId === truck?.id);
 const dockTruck = dock ? s.trucks.find(t => t.dockId === dock.id && isDocked(t)) : undefined;
 const title = truck?.name ?? f?.name ?? p?.name ?? c?.name ?? dock?.name ?? item?.name ?? site.name;
 const eyebrow = truck?.carrier ?? (f ? 'XE NÂNG' : p ? 'PALLET · ' + p.sku : c ? 'TRẠM SẠC' : dock ? 'CỬA XUẤT NHẬP' : item ? 'TỒN KHO' : kindLabel[site.kind]);
 const subtitle = truck ? truck.driver + ' · ' + truck.plate : f ? f.driver + ' · ' + f.model : p ? 'PAL-' + p.id.toUpperCase() + ' · ' + p.sku : c ? 'Bộ sạc lithium-ion 48 V' : site.address;
 return <aside className={'inspector glass ' + (expanded ? 'inspector-expanded' : '')} aria-label="Thông tin đối tượng" key={s.siteId}>
  <div className="panel-heading"><span className="eyebrow">{eyebrow} · {site.code}</span><div>
   <button className="icon-button" aria-label="Định vị đối tượng" onClick={() => s.camera('focus')}><IconFocus2 size={16}/></button>
   <button className="icon-button" aria-label="Mở rộng thông tin" aria-pressed={expanded} onClick={() => setExpanded(v => !v)}><IconArrowUpRight size={16}/></button>
   <button className="icon-button" aria-label="Bỏ chọn đối tượng" onClick={() => select(null)}><IconX size={16}/></button></div></div>
  <h2 data-testid="object-title">{title}</h2><p className="object-subtitle">{subtitle}</p>
  <div className="inspector-scroll">
  {truck && <><Badge status={truck.status}/><p className="state-description">{truck.status === 'docking' ? 'Đang lùi vào ' + s.docks.find(d => d.id === truck.dockId)?.name : truck.inbound ? 'Luồng nhập kho · ' + statusLabel[truck.status] : 'Luồng xuất kho · ' + statusLabel[truck.status]}</p>
   <div className="progress-section"><div><span>Tiến độ {truck.inbound ? 'dỡ' : 'xếp'} hàng</span><strong>{Math.min(6, Math.floor((truck.progress + .000001) * 6 / 100))}/6 pallet</strong></div><Progress value={truck.progress} green/><small>{Math.ceil(remainingSeconds(truck) / 60)} phút còn lại</small></div>
   <div className="detail-list"><Detail label="Lô hàng" value={sh?.id}/><Detail label="Khách hàng" value={sh?.customer}/><Detail label="Điểm đến" value={sh?.destination}/><Detail label="ETA dự kiến" value={sh?.eta}/><Detail label="Tốc độ" value={(truck.speed*3.6).toFixed(1)+' km/h'}/><Detail label="Cửa" value={s.docks.find(d => d.id === truck.dockId)?.name ?? 'Chưa phân cửa'}/><Detail label="Hàng hóa" value={'6 pallet · ' + sh?.weight}/></div></>}
  {f && <><Chip tone={f.status === 'charging' ? 'orange' : 'green'}>{forkliftLabel[f.status]}</Chip><div className="progress-section"><div><span>Pin còn lại</span><strong><IconBattery3 size={15}/>{Math.round(f.battery)}%</strong></div><Progress value={f.battery} green/></div><div className="detail-list"><Detail label="Đang mang" value={s.pallets.find(p => p.id === f.carrying)?.name ?? 'Càng trống'}/><Detail label="Công việc" value={s.trucks.find(t => t.id === f.truckId)?.name ?? 'Chờ điều phối'}/><Detail label="Lượt hôm nay" value={f.movesToday}/><Detail label="Tốc độ" value={(f.speed*3.6).toFixed(1)+' km/h'}/><Detail label="Trạm sạc" value={s.chargers.find(c => c.id === f.chargerId)?.name ?? '—'}/><Detail label="Kho" value={site.name}/></div></>}
  {p && <><Chip tone={p.status === 'moving' ? 'blue' : 'green'}>{{ staged: 'Đang chờ', moving: 'Đang di chuyển', in_rack: 'Trên kệ', loaded: 'Đã xếp lên xe' }[p.status]}</Chip><div className="detail-list"><Detail label="Số lượng" value={p.quantity + ' sản phẩm'}/><Detail label="Khối lượng" value={p.weightKg + ' kg'}/><Detail label="Vị trí" value={p.location}/><Detail label="Lô sản xuất" value={p.lot}/><Detail label="Tiếp nhận" value={formatTime(p.receivedAt) + ' · 17/10/2026'}/><Detail label="Kho" value={site.name}/></div></>}
  {c && <><Chip tone={c.forkliftId ? 'orange' : 'green'}>{c.forkliftId ? 'Đang sạc ' + s.forklifts.find(f => f.id === c.forkliftId)?.name : 'Sẵn sàng'}</Chip><div className="detail-list"><Detail label="Phiên sạc hôm nay" value={c.sessions}/><Detail label="Điện năng" value={c.energyKwh.toFixed(1) + ' kWh'}/><Detail label="Tốc độ sạc" value={c.rate + '% / phút'}/><Detail label="Kho" value={site.name}/></div>{c.forkliftId && <button className="text-button" onClick={() => select({ kind: 'forklift', id: c.forkliftId! })}>Xem xe đang sạc<IconArrowUpRight size={16}/></button>}</>}
  {dock && <><Chip tone={dockTruck ? 'blue' : 'gray'}>{dockTruck ? 'Đang sử dụng' : 'Sẵn sàng'}</Chip><div className="detail-list"><Detail label="Luồng" value={dock.direction === 'in' ? 'Nhập hàng' : 'Xuất hàng'}/><Detail label="Xe được phân" value={dockTruck?.name ?? 'Chưa có xe'}/><Detail label="Kho" value={site.name}/></div>{dockTruck && <button className="text-button" onClick={() => select({ kind: 'truck', id: dockTruck.id })}>Xem xe tại cửa<IconArrowUpRight size={16}/></button>}</>}
  {item && <><Chip tone={item.quantity < item.minimum ? 'orange' : 'green'}>{item.quantity < item.minimum ? 'Tồn kho thấp' : 'Còn hàng'}</Chip><div className="detail-list"><Detail label="SKU" value={item.sku}/><Detail label="Vị trí" value={item.location}/><Detail label="Tồn kho" value={item.quantity + ' pallet'}/><Detail label="Tối thiểu" value={item.minimum + ' pallet'}/></div></>}
  {selection.kind === 'site' && <><div className="site-status"><Chip>Đang hoạt động</Chip><span>{m.busyDocks} tại cửa · {s.trucks.filter(t => t.siteId === s.siteId && t.status === 'en_route').length} đang đến</span></div>
   <div className="stat-grid"><Tile label="Hàng trong kho" value={<>{m.stock.toLocaleString('en-US')} <small>/ {site.capacity.toLocaleString('en-US')}</small></>}><Progress value={m.stock / site.capacity * 100}/></Tile><Tile label="Cửa xuất nhập" value={<>{m.busyDocks} <small>/ {m.totalDocks} đang dùng</small></>}><Progress value={m.busyDocks / m.totalDocks * 100} green/></Tile><Tile label="Xuất kho hôm nay" value={m.outbound}/><Tile label="Nhập kệ hôm nay" value={m.putaways}/></div>
   <div className="section-title"><h3>Tồn kho</h3><span>4 mã hàng</span></div><div className="inventory-list">{s.inventory.filter(i => i.siteId === s.siteId).map(i => <button key={i.id} onClick={() => select({ kind: 'inventory', id: i.id })}><span className="inventory-icon"><IconPackage size={17}/></span><span><strong>{i.name}</strong><small>{i.quantity.toLocaleString('en-US')} pallet</small></span><span className={'stock-chip ' + (i.quantity < i.minimum ? 'orange' : '')}>{i.quantity < i.minimum ? 'Sắp hết' : 'Còn hàng'}</span></button>)}</div>
   <div className="section-title"><h3>Đội xe nâng</h3><span>{s.forklifts.filter(f => f.siteId === s.siteId && f.active).length}/3 làm việc</span></div><div className="forklift-summary">{s.forklifts.filter(f => f.siteId === s.siteId).map(f => <button key={f.id} onClick={() => select({ kind: 'forklift', id: f.id })}><IconBattery3 size={17}/><strong>{f.name}</strong><span>{forkliftLabel[f.status]}</span><small>{Math.round(f.battery)}%</small></button>)}</div>
  </>}
  </div><div className="inspector-footer"><IconMapPin size={13}/>{site.city}<select aria-label="Chọn đối tượng trong kho" value={selection.kind + ':' + selection.id} onChange={e => { const [kind, id] = e.target.value.split(':'); select({ kind: kind as Selection['kind'], id }); }}>
   <option value={'site:' + site.id}>Tổng quan kho</option>{(['trucks','docks','forklifts','pallets','chargers','inventory'] as const).map((collection, index) => <optgroup key={collection} label={['Xe tải','Cửa kho','Xe nâng','Pallet','Trạm sạc','Tồn kho'][index]}>{s[collection].filter(e => e.siteId === s.siteId).map(e => <option key={e.id} value={['truck','dock','forklift','pallet','charger','inventory'][index] + ':' + e.id}>{e.name}{collection === 'pallets' ? ' · ' + e.id.toUpperCase() : ''}</option>)}</optgroup>)}</select></div>
 </aside>;
}
