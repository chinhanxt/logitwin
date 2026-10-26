import { IconBox, IconChartBar, IconSparkles, IconTruck, IconArrowRight, IconChevronRight } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { Overview } from "./api";
import Network from "./Network";
export default function Dashboard({ data, cards, onDecisions }: { data: Overview; cards: ReactNode; onDecisions: () => void }) {
  const pending = data.decisions.filter((d) => d.status === "pending").length,
    totals = data.stocks.length,
    atRisk = data.forecasts.filter((f) => f.cover < 2).length;
  return (
    <>
      <div className="metrics">
        {[
          {
            title: "Dòng tồn kho",
            value: totals,
            suffix: "dòng hàng",
            icon: IconBox,
            note: `${data.stocks.length} dòng · ${new Set(data.stocks.map((s) => s.store)).size} cửa hàng`,
          },
          { title: "Cần bổ sung hàng", value: atRisk, suffix: "dòng hàng", icon: IconChartBar, note: "Dưới mức phủ 2 ngày" },
          { title: "Quyết định chờ duyệt", value: pending, suffix: "đề xuất", icon: IconSparkles, note: "Người duyệt khác người lập" },
          {
            title: "Lệnh đang xử lý",
            value: data.movements.filter((m) => m.status !== "received").length,
            suffix: "lệnh",
            icon: IconTruck,
            note: "Giữ hàng hoặc đặt mua",
          },
        ].map((m) => (
          <article className="metric" key={m.title}>
            <div>
              <span>{m.title}</span>
              <m.icon size={19} />
            </div>
            <strong>
              {m.value}
              <small>{m.suffix}</small>
            </strong>
            <p>{m.note}</p>
          </article>
        ))}
      </div>
      <div className="overview-grid">
        <section className="panel network-panel">
          <div className="panel-heading">
            <div>
              <h2>Mạng lưới vận hành</h2>
              <p>Tồn kho cập nhật từ lõi số</p>
            </div>
            <span className="tag">3 cửa hàng</span>
          </div>
          <Network data={data} />
        </section>
        <section className="panel recommendation-panel">
          <div className="panel-heading">
            <div>
              <h2>Đề xuất hành động</h2>
              <p>Từ baseline 7 ngày dữ liệu mẫu</p>
            </div>
            <span className="sparkle-square">
              <IconSparkles size={20} />
            </span>
          </div>
          {cards}
          <button className="text-button" onClick={() => onDecisions()}>
            Xem tất cả quyết định <IconArrowRight size={16} />
          </button>
        </section>
      </div>
      <section className="flow-strip">
        <div>
          <span className="eyebrow">WORKFLOW HEADLESS</span>
          <h3>Một luồng. Có kiểm soát.</h3>
        </div>
        {["Dữ liệu", "Phân tích", "Phê duyệt", "Thực thi", "Audit"].map((s, i) => (
          <div className="flow-step" key={s}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            {s}
            {i < 4 && <IconChevronRight size={15} />}
          </div>
        ))}
      </section>
    </>
  );
}
