import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { IconBox, IconChartBar, IconChevronLeft, IconChevronRight, IconHelp, IconHome, IconLayersIntersect, IconMinus, IconPackage, IconPlayerPause, IconPlayerPlay, IconPlus, IconSettings, IconTruck } from '@tabler/icons-react';
import { useWarehouse } from './data/store';
import { playback } from './sim/playback';
import Header from './components/Header';
import Metrics from './components/Metrics';
import Inspector from './components/Inspector';
import FleetBoard from './components/FleetBoard';
import ShipmentTracking from './components/ShipmentTracking';
import { DataDrawer } from './components/Operations';
import HelpDialog from './components/HelpDialog';
import type { Drawer } from './components/types';
const WarehouseScene = lazy(() => import('./scene/WarehouseScene'));
export default function App() {
 const s = useWarehouse();
 const [drawer, setDrawer] = useState<Drawer>(null), [help, setHelp] = useState(false), [notifications, setNotifications] = useState(false);
 const [panel, setPanel] = useState<'details' | 'fleet' | 'tracking' | 'metrics' | 'settings' | null>(null);
 const togglePanel = (next: NonNullable<typeof panel>) => {
  setPanel(current => current === next ? null : next);
  setNotifications(false);
 };
 useEffect(() => { setPanel(null); }, [s.siteId]);
 useEffect(() => {
  if (!s.selection) setPanel(current => current === 'details' ? null : current);
  else if (s.selection.kind !== 'site') setPanel('details');
 }, [s.selection]);
 const dialogOpen = drawer !== null || help;
 const previousFocus = useRef<HTMLElement | null>(null);
 useEffect(() => {
  let last = performance.now(), accumulated = 0;
  let frame=0;
  const advance = (now: number) => {
   const state = useWarehouse.getState();
   if (state.running && !document.hidden) {
    accumulated += Math.min(.1, (now - last) / 1000) * state.speed;
    while (accumulated >= 1) { useWarehouse.getState().tick(); accumulated--; }
    playback.fraction=accumulated;
   }
   last=now;frame=requestAnimationFrame(advance);
  };
  frame=requestAnimationFrame(advance);
  return () => cancelAnimationFrame(frame);
 }, []);
 useEffect(() => {
  if (dialogOpen) { previousFocus.current ??= document.activeElement as HTMLElement; document.querySelector<HTMLElement>('[role="dialog"] button')?.focus(); }
  else if (previousFocus.current) {
   const target = previousFocus.current.isConnected ? previousFocus.current : document.querySelector<HTMLElement>('[aria-label="Cài đặt hiển thị"]');
   target?.focus();
   previousFocus.current=null;
  }
 }, [dialogOpen]);
 useEffect(() => {
  const handler = (e: KeyboardEvent) => {
   if (e.key === 'Escape') {
    if (dialogOpen) { setDrawer(null); setHelp(false); }
    else if (notifications) setNotifications(false);
    else if (useWarehouse.getState().search) useWarehouse.getState().setSearch('');
    else {setPanel(null);useWarehouse.getState().select(null);}
   }
   if (e.key === 'Tab' && dialogOpen) {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"] button, [role="dialog"] input, [role="dialog"] select')).filter(el => !el.hasAttribute('disabled'));
    if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1)?.focus(); }
    else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0]?.focus(); }
   }
  };
  document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler);
 }, [dialogOpen, notifications]);
 const openDrawer = (mode: Drawer) => { previousFocus.current=document.activeElement as HTMLElement; s.setSearch(''); setPanel(null); setDrawer(mode); };
 return <div className={'app-shell focus-map ' + (panel === 'details' ? 'has-details' : '')}>
  <main className="world" aria-label="Không gian vận hành kho"><Suspense fallback={<div className="scene-loading">Đang dựng không gian 3D…</div>}><WarehouseScene/></Suspense></main>
  <div className="hud">
   <Header notifications={notifications} setNotifications={setNotifications} openDrawer={openDrawer}/>
   {panel === 'metrics' && <Metrics/>}
   <div className="camera-controls glass" aria-label="Điều khiển camera">{[
    { action: 'in' as const, label: 'Phóng to', Icon: IconPlus }, { action: 'out' as const, label: 'Thu nhỏ', Icon: IconMinus },
    { action: 'left' as const, label: 'Xoay trái', Icon: IconChevronLeft }, { action: 'right' as const, label: 'Xoay phải', Icon: IconChevronRight },
    { action: 'reset' as const, label: 'Đặt lại góc nhìn', Icon: IconHome },
   ].map(c => <button key={c.action} className="icon-button" aria-label={c.label} title={c.label} onClick={() => s.camera(c.action)}><c.Icon size={19}/></button>)}</div>
   {panel === 'details' && <Inspector/>}
   {panel === 'tracking' && <ShipmentTracking onExpand={() => openDrawer('shipments')}/>}
   {panel === 'fleet' && <FleetBoard/>}
   <nav className="panel-toggles glass" aria-label="Công cụ bản đồ">
    <button className="icon-button" aria-label={s.running ? 'Tạm dừng mô phỏng' : 'Tiếp tục mô phỏng'} onClick={s.toggleRunning}>{s.running ? <IconPlayerPause size={19}/> : <IconPlayerPlay size={19}/>}</button>
    <button className="icon-button" aria-label="Trong kho" aria-pressed={!s.roof} onClick={s.toggleRoof}><IconLayersIntersect size={19}/></button>
    <span className="dock-divider"/>
    <button className="icon-button" aria-label="Thông tin kho" aria-expanded={panel === 'details'} onClick={() => { if (!s.selection) s.select({kind:'site',id:s.siteId}); togglePanel('details'); }}><IconBox size={19}/></button>
    <button className="icon-button" aria-label="Đội vận hành" aria-expanded={panel === 'fleet'} onClick={() => togglePanel('fleet')}><IconTruck size={19}/></button>
    <button className="icon-button" aria-label="Hành trình lô hàng" aria-expanded={panel === 'tracking'} onClick={() => togglePanel('tracking')}><IconPackage size={19}/></button>
    <button className="icon-button" aria-label="Chỉ số vận hành" aria-expanded={panel === 'metrics'} onClick={() => togglePanel('metrics')}><IconChartBar size={19}/></button>
    <span className="dock-divider"/>
    <button className="icon-button" aria-label="Cài đặt hiển thị" aria-expanded={panel === 'settings'} onClick={() => togglePanel('settings')}><IconSettings size={19}/></button>
   </nav>
   {panel === 'settings' && <section className="settings-popover glass" aria-label="Cài đặt hiển thị">
    <strong>Tùy chọn</strong>
    <label>Tốc độ<select aria-label="Tốc độ mô phỏng" value={s.speed} onChange={e => s.setSpeed(Number(e.target.value))}>{[1,6,12,24].map(n => <option key={n} value={n}>{n}×</option>)}</select></label>
    <label>Chất lượng<select aria-label="Chất lượng đồ họa" value={s.quality} onChange={e => s.setQuality(e.target.value as 'auto' | 'low')}><option value="auto">Tự động</option><option value="low">Tiết kiệm GPU</option></select></label>
    <label>Nhãn bản đồ<input type="checkbox" checked={s.labels} onChange={s.toggleLabels}/></label>
    <div className="settings-actions"><button onClick={() => openDrawer('inventory')}><IconPackage size={17}/>Tồn kho</button><button onClick={() => openDrawer('shipments')}><IconTruck size={17}/>Lô hàng</button><button onClick={() => setHelp(true)}><IconHelp size={17}/>Hướng dẫn</button></div>
   </section>}

  </div>
  {drawer && <DataDrawer mode={drawer} close={() => setDrawer(null)}/>}
  {help && <HelpDialog close={() => setHelp(false)}/>}
 </div>;
}
