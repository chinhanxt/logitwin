import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { IconBell, IconChevronRight, IconCube, IconSearch, IconX } from '@tabler/icons-react';
import { getMetrics, useWarehouse } from '../data/store';
import { sites } from '../data/seed';
import type { Selection } from '../data/model';
import { formatTime } from '../sim/engine';
import type { Drawer } from './types';
export default function Header({ notifications, setNotifications, openDrawer }: {
 notifications: boolean; setNotifications: Dispatch<SetStateAction<boolean>>; openDrawer: (mode: Drawer) => void;
}) {
 const s = useWarehouse(), site = sites.find(site => site.id === s.siteId)!, m = getMetrics(s, s.siteId);
 const input = useRef<HTMLInputElement>(null), searchButton = useRef<HTMLButtonElement>(null);
 const [searchOpen, setSearchOpen] = useState(false);
 useEffect(() => { if (searchOpen) input.current?.focus(); }, [searchOpen]);
 useEffect(() => { if (!s.search) setSearchOpen(false); }, [s.selection]);
 const closeSearch = () => { setSearchOpen(false); s.setSearch(''); searchButton.current?.focus(); };
 useEffect(() => {
  const handler = (e: KeyboardEvent) => {
   if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) { e.preventDefault(); setSearchOpen(true); input.current?.focus(); }
  };
  document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler);
 }, []);
 const q = s.search.trim().toLocaleLowerCase('vi');
 const results: { selection: Selection; title: string; sub: string }[] = [
  ...sites.map(e => ({ selection: { kind: 'site' as const, id: e.id }, title: e.name, sub: e.code + ' · ' + e.city })),
  ...s.trucks.map(e => ({ selection: { kind: 'truck' as const, id: e.id }, title: e.name, sub: e.plate + ' · ' + e.carrier + ' · ' + e.shipmentId + ' · ' + s.shipments.find(sh => sh.truckId === e.id)?.destination })),
  ...s.forklifts.map(e => ({ selection: { kind: 'forklift' as const, id: e.id }, title: e.name, sub: e.siteId + ' · ' + e.driver })),
  ...s.pallets.map(e => ({ selection: { kind: 'pallet' as const, id: e.id }, title: 'PAL-' + e.id.toUpperCase(), sub: e.name + ' · ' + e.sku })),
  ...s.chargers.map(e => ({ selection: { kind: 'charger' as const, id: e.id }, title: e.name + ' · ' + e.siteId, sub: 'Trạm sạc 48 V' })),
  ...s.docks.map(e => ({ selection: { kind: 'dock' as const, id: e.id }, title: e.name + ' · ' + e.siteId, sub: 'Cửa xuất nhập' })),
 ].filter(e => (e.title + ' ' + e.sub).toLocaleLowerCase('vi').includes(q)).slice(0, 14);
 return <header className="topbar">
  <a className="brand" href="/" aria-label="KhoSpace trang chính" title="KhoSpace"><span className="brand-symbol"><IconCube size={22} stroke={1.7}/></span></a>
  <div className="site-selector"><select aria-label="Địa điểm kho" value={s.siteId} onChange={e => {s.setSite(e.target.value);closeSearch();}}>
   {sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></div>
  <span className={'live-clock ' + (!s.running ? 'paused' : '')} aria-label={s.running ? 'Mô phỏng đang chạy' : 'Mô phỏng tạm dừng'}><i className="live-dot"/><b>{formatTime(s.seconds)}</b></span>
  <button ref={searchButton} className="icon-button search-toggle" aria-label="Tìm kiếm" aria-expanded={searchOpen} aria-controls="global-search" onClick={() => {if(searchOpen)closeSearch();else setSearchOpen(true);}}><IconSearch size={19}/></button>
  {searchOpen && <div className="global-search" id="global-search"><IconSearch size={17}/><input ref={input} aria-label="Tìm kho, xe, pallet, lô hàng" placeholder="Tìm kiếm…" value={s.search}
   onChange={e => s.setSearch(e.target.value)} onKeyDown={e => {
    if (e.key === 'Escape') {e.stopPropagation();closeSearch();}
    if (e.key === 'Enter' && results[0]) {s.select(results[0].selection);closeSearch();}
   }}/><button className="icon-button" aria-label="Đóng tìm kiếm" onClick={closeSearch}><IconX size={16}/></button>
   {q && <div className="search-results" aria-label="Kết quả tìm kiếm">
    {results.length ? results.map(r => <button key={r.selection.kind + r.selection.id} onClick={() => {s.select(r.selection);closeSearch();}}><IconCube size={16}/><span><strong>{r.title}</strong><small>{r.sub}</small></span><IconChevronRight size={14}/></button>) : <p className="empty-state">Không tìm thấy đối tượng.</p>}</div>}
  </div>}
  <div className="notification-wrap"><button className="icon-button" aria-label="Thông báo" aria-expanded={notifications} onClick={() => setNotifications(v => !v)}><IconBell size={20}/><i className="notification-dot"/></button>
   {notifications && <div className="notification-popover"><div className="popover-caption">TRUNG TÂM THÔNG BÁO · {site.code}</div>
    <button onClick={() => { openDrawer('inventory'); setNotifications(false); }}><strong>{m.lowStock} mặt hàng sắp hết</strong><small>Kiểm tra tồn kho và vị trí lưu trữ</small></button>
    {s.events.filter(e => e.siteId === s.siteId).slice(-4).reverse().map((e, i) => <div className="event-row" key={i}><span>{formatTime(e.t)}</span><strong>{e.entityId.toUpperCase()}</strong><small>{e.type}</small></div>)}
    <p className="simulation-note">Dữ liệu mô phỏng · không kết nối WMS</p></div>}
  </div>

 </header>;
}
