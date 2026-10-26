import type { ReactNode } from 'react';
export function Chip({ children, tone = 'green' }: { children: ReactNode; tone?: string }) {
 return <span className={'badge ' + tone}><i />{children}</span>;
}
export function Progress({ value, green = false }: { value: number; green?: boolean }) {
 return <div className={'progress-track ' + (green ? 'green' : '')}><span style={{ width: Math.max(0, Math.min(100, value)) + '%' }} /></div>;
}
export function Detail({ label, value }: { label: string; value: ReactNode }) {
 return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div>;
}
export function Tile({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
 return <div className="stat-tile"><span>{label}</span><strong>{value}</strong>{children}</div>;
}
