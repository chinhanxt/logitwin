import type { Overview } from "./api";
import { storeName } from "./api";
export default function Network({ data }: { data: Overview }) {
  const positions = [
    { id: "q1", x: 390, y: 130 },
    { id: "q3", x: 190, y: 220 },
    { id: "q7", x: 520, y: 310 },
  ];
  return (
    <div className="network">
      <div className="network-label">
        <span className="live-dot" /> MẠNG LƯỚI HÀNG TƯƠI <small>Sơ đồ minh họa · không phải bản đồ</small>
      </div>
      <svg viewBox="0 0 720 420" role="img" aria-label="Sơ đồ kết nối ba cửa hàng Quận 1, Quận 3 và Quận 7">
        <defs>
          <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0H0V28" fill="none" stroke="#e7eef5" strokeWidth="1" />
          </pattern>
          <filter id="shadow">
            <feDropShadow dx="0" dy="8" stdDeviation="9" floodColor="#244f7b" floodOpacity=".12" />
          </filter>
        </defs>
        <rect width="720" height="420" fill="url(#grid)" />
        <path d="M-30 285L275 105L750 325M45 425L650 60M-20 175L500 440" stroke="#fff" strokeWidth="25" fill="none" />
        <path d="M190 220L390 130L520 310Z" stroke="#87b6ee" strokeWidth="2" strokeDasharray="6 6" fill="#d6e9fb" fillOpacity=".18" />
        {positions.map((p) => {
          const stocks = data.stocks.filter((s) => s.store === p.id);
          const alerts = data.forecasts.filter((f) => stocks.some((s) => s.id === f.stockId) && f.cover < 2).length;
          return (
            <g key={p.id} transform={`translate(${p.x},${p.y})`}>
              <ellipse cy="35" rx="65" ry="24" fill="#cbdcee" opacity=".45" />
              <g filter="url(#shadow)">
                <path d="M-52 0L0 -30L52 0V42L0 72L-52 42Z" fill="#fff" />
                <path d="M0 15L52 -15V30L0 60Z" fill="#c5dbf4" />
                <path d="M-52 -15L0 15V60L-52 30Z" fill="#e4edf8" />
                <path d="M-60 -17L0 -51L60 -17L0 18Z" fill="#458ce2" />
                <path d="M-35 9L-18 19V42L-35 32Z" fill="#93bce9" />
                <path d="M14 20L38 6V33L14 47Z" fill="#fff" />
              </g>
              <rect x="-67" y="-96" width="134" height="39" rx="12" fill="white" stroke="#e3eaf2" />
              <circle cx="-47" cy="-77" r="4" fill={alerts ? "#f5a524" : "#29b88a"} />
              <text x="-35" y="-72" fill="#29415e" fontSize="14" fontWeight="600">
                {storeName(p.id)}
              </text>
              <text x="0" y="99" textAnchor="middle" fill="#64768c" fontSize="12">
                {stocks.length} dòng tồn · {alerts} cần bổ sung
              </text>
            </g>
          );
        })}
      </svg>
      <div className="map-legend">
        <span>
          <i className="dot blue" /> 3 cửa hàng
        </span>
        <span>
          <i className="dot orange" /> Thiếu mức phủ 2 ngày
        </span>
        <span>TP. Hồ Chí Minh</span>
      </div>
    </div>
  );
}
