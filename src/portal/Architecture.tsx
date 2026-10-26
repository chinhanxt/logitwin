const layers = [
  [
    "01",
    "Trải nghiệm & đa kênh",
    "Portal Intelligence · 3D · SSE",
    "Đang chạy",
    "Portal trắng sáng, 3D và cập nhật SSE theo tenant. Chưa có app mobile native.",
  ],
  [
    "02",
    "Biên, định danh & bảo mật",
    "Keycloak OIDC · gateway phát triển",
    "Một phần",
    "OIDC code + PKCE, token có chữ ký, phân quyền và gateway riêng. Chưa có gateway production, Vault, WAF và kiểm dịch tệp.",
  ],
  [
    "03",
    "Nghiệp vụ & trạng thái thực thể",
    "SQLite · lô FEFO · tồn đang vận chuyển",
    "Một phần",
    "Lô nhập, FEFO, giữ/xuất/nhận/hủy và cách ly theo nhiệt độ mẫu. Chưa có PostGIS, vòng đời WMS đầy đủ, NGSI-LD và cảm biến thật.",
  ],
  [
    "04",
    "Tự động hóa & workflow",
    "bpmn-engine · checkpoint bền vững",
    "Một phần",
    "BPMN kiểm soát bước duyệt/thực thi/xuất/nhận; checkpoint và nghiệp vụ commit cùng nhau, đã thử mở lại DB. Chưa có GitOps hoặc backup/restore toàn hệ thống.",
  ],
  [
    "05",
    "Sự kiện, Lakehouse & sổ cái",
    "Audit giao dịch · SSE replay",
    "Một phần",
    "Audit có chuỗi hash cục bộ và phát lại qua SSE. Chưa có broker Redpanda, ledger immudb hoặc Iceberg Lakehouse.",
  ],
  [
    "06",
    "Phân tích & trí tuệ số",
    "Forecast baseline · Ollama RAG · 5 mục",
    "Một phần",
    "Forecast 7 ngày mẫu, RAG bge-m3 + Gemma2, tuyến greedy có giới hạn tải/thời gian. Chưa có FL, PACO, OCR và dữ liệu chuỗi lạnh thật.",
  ],
  [
    "07",
    "Quản trị, tìm kiếm & quan sát",
    "Metadata · semantic retrieval · request log",
    "Một phần",
    "Tài liệu theo tenant, phiên bản, embedding lưu bền và audit. Chưa có catalog, dashboard metrics hoặc vector DB riêng.",
  ],
];
export default function Architecture() {
  return (
    <div className="architecture">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ĐỐI CHIẾU ĐỀ THI</span>
          <h2>Ba tầng kiến trúc. Bảy lớp chức năng.</h2>
          <p>Trạng thái triển khai có thể kiểm chứng; tên công nghệ trong đề là phương án tham khảo.</p>
        </div>
      </div>
      <div className="tier-grid">
        {[
          ["TẦNG 1", "Lõi số headless", "API, dữ liệu, workflow và audit chạy ở server."],
          ["TẦNG 2 · [I]", "Không gian Intelligence", "Người dùng xem phân tích, ra lệnh và phê duyệt."],
          ["TẦNG 3", "Nghiệp vụ Logistics", "Nhập hàng, giảm giá, điều chuyển hàng tươi."],
        ].map((t) => (
          <article key={t[0]}>
            <span>{t[0]}</span>
            <h3>{t[1]}</h3>
            <p>{t[2]}</p>
          </article>
        ))}
      </div>
      <div className="layer-list">
        {layers.map((l) => (
          <article key={l[0]}>
            <b className="layer-number">{l[0]}</b>
            <div>
              <h3>{l[1]}</h3>
              <strong>{l[2]}</strong>
              <p>{l[4]}</p>
            </div>
            <span className={`badge ${l[3] === "Đang chạy" ? "executed" : "pending"}`}>{l[3]}</span>
          </article>
        ))}
      </div>
      <div className="notice">
        Bản phát triển cục bộ, chưa đáp ứng toàn bộ đề thi. “Bảy lớp công nghệ” khác với “bảy nhóm dịch vụ lõi” ở Tầng 1. SSO, gateway, BPMN và 3D/SSE
        đã chạy cục bộ; quản trị tệp, OT thật, Lakehouse và GitOps vẫn cần hoàn thiện.
      </div>
    </div>
  );
}
