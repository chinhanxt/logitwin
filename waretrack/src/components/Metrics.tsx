import { useEffect, useRef, useState } from 'react';
import { IconArrowUpRight, IconPackage, IconTargetArrow, IconTruck } from '@tabler/icons-react';
import { getMetrics, useWarehouse } from '../data/store';
import { sites } from '../data/seed';
function Count({ value, decimal = false }: { value: number; decimal?: boolean }) {
 const [display, setDisplay] = useState(value), previous = useRef(value);
 useEffect(() => {
  const from = previous.current; previous.current = value;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setDisplay(value); return; }
  const start = performance.now(); let frame = 0;
  const update = (now: number) => { const p = Math.min(1, (now - start) / 700); setDisplay(from + (value - from) * (1 - Math.pow(1 - p, 3))); if (p < 1) frame = requestAnimationFrame(update); };
  frame = requestAnimationFrame(update); return () => cancelAnimationFrame(frame);
 }, [value]);
 return <>{display.toLocaleString('en-US', { minimumFractionDigits: decimal ? 1 : 0, maximumFractionDigits: decimal ? 1 : 0 })}</>;
}
export default function Metrics() {
 const s = useWarehouse(), m = getMetrics(s, s.siteId), site = sites.find(site => site.id === s.siteId)!;
 const cards = [
  { Icon: IconPackage, label: 'Hàng trong kho', value: m.stock, delta: (m.stockDelta >= 0 ? '+' : '') + m.stockDelta, note: 'pallet · ' + site.code },
  { Icon: IconTruck, label: 'Xe tại kho', value: m.activeTrucks, delta: m.inbound + ' nhập', note: m.busyDocks + ' xe tại cửa · ' + site.code },
  { Icon: IconTargetArrow, label: 'Giao hàng đúng hẹn', value: m.onTime, delta: '+0.4%', note: '30 ngày gần nhất · mẫu' },
 ];
 return <section className="metrics" aria-label="Chỉ số vận hành">{cards.map((c, i) => <article className="metric" key={c.label}><span className="metric-icon"><c.Icon size={20} stroke={1.7}/></span><span className="metric-label">{c.label}</span><div className="metric-value"><Count value={c.value} decimal={i === 2}/>{i === 2 && <small>%</small>}<span className="metric-delta"><IconArrowUpRight size={13}/>{c.delta}</span></div><small className="metric-note">{c.note}</small></article>)}</section>;
}
