# Đối chiếu DX-OS Open-Core

Nguồn: PDF người dùng cung cấp, [Google Drive](https://drive.google.com/file/d/1zHsxzfMhUp-yxf0EbFGpKTYt60JiDGAF/view). Toàn văn đề không đưa vào repo. Đối chiếu này phân biệt yêu cầu bắt buộc (§3) với kiến trúc/công nghệ tham khảo (§2, §4).

## Ba tầng

| Tầng | Vai trò | Triển khai hiện tại |
|---|---|---|
| 1 | PaaS headless dùng chung | API, SSO, repository, audit, tài liệu, RAG ở `src/core`; gateway riêng |
| 2 | Ít nhất một không gian H/P/D/I có UI | Portal [I] Intelligence trắng sáng ở `src/portal` |
| 3 | Module nghiệp vụ cắm vào nền tảng | Logistics hàng tươi ở `src/modules/logistics` |

Bốn không gian HPDI khác với bốn nhóm dòng nghiệp vụ ở Tầng 3. Logistics là dòng hàng hóa; chọn [I] ở Tầng 2 không có nghĩa phải tạo bốn app H/P/D/I để đạt mức tối thiểu.

## Yêu cầu lõi bắt buộc — §3, trang 4

| Yêu cầu | Bằng chứng hiện tại | Giới hạn |
|---|---|---|
| Identity/SSO | Keycloak 26.6.3; authorization code + PKCE, nonce/state, JWKS/issuer/audience/expiry; E2E hai tài khoản | Local dev; chưa MFA, SSO nhiều app hoặc revocation tức thời |
| API Gateway | Portal proxy qua tiến trình gateway 5193 đến core 5191; fixed upstream, body limit, rate limit, timeout | Gateway tự xây cho development, chưa APISIX/WAF/TLS/production |
| Dữ liệu có cấu trúc | SQLite WAL, transaction, tenant-scope, phiên bản, lô/FEFO, tồn đang vận chuyển, đơn mua/nhận, đóng/mở DB vẫn giữ trạng thái | Chưa PostgreSQL RLS, WMS hoàn chỉnh, lakehouse và quản trị lifecycle |
| Dữ liệu phi cấu trúc | Văn bản SOP, classification, phiên bản, tenant, nguồn audit, embedding cùng phiên bản | Chưa file/object storage, kiểm dịch, OCR và retention |
| Workflow headless | Đề xuất → duyệt/từ chối → thực thi → nhận hàng; cold-chain hold/release; kiểm tra lại điều kiện | bpmn-engine + domain commit/checkpoint đã chạy; chưa distributed orchestration/GitOps |
| Tầng 2 HPDI | Intelligence portal, giải thích 5 mục, RAG/SOP, quyết định và đối chiếu 7 lớp | Chưa hoàn thành toàn bộ chức năng AI Agent/OCR trong mô tả tham khảo |

## Bảy lớp chức năng công nghệ — §4, trang 5–6

| Lớp | Vai trò | Đã chạy | Còn thiếu so với gợi ý |
|---|---|---|---|
| 1 | Trải nghiệm đa kênh | React portal, cảnh kho WareTrack/mạng lưới 3D gắn API, chuyển động minh họa, responsive, SSE theo tenant, thao tác có quyền | App mobile native, vị trí/cảm biến kho thực |
| 2 | Biên, identity, bảo mật | Keycloak, gateway, kiểm tra role/tenant | APISIX production, Vault, WAF, kiểm dịch, MFA |
| 3 | Logic và trạng thái thực thể | Lô FEFO/provenance, xuất/nhận/hủy, tồn vật lý/đang đi, telemetry mẫu/cách ly | PostgreSQL/PostGIS, entity broker NGSI-LD, cảm biến thật, WMS vòng đời đầy đủ |
| 4 | Automation, workflow, DevSecOps | Engine BPMN MIT, fixed XML, checkpoint cùng transaction, đã thử mở lại DB | GitOps, workflow đa dịch vụ, backup/restore toàn hệ thống |
| 5 | Streaming, Lakehouse, ledger | Sự kiện lưu bền, SSE replay, kiểm tra hash cục bộ | Broker Redpanda, Iceberg, object store, ledger immudb hoặc tương đương |
| 6 | Analytics, spatial, Intelligence | Forecast baseline, greedy route preview, Ollama local + semantic RAG, 5 mục | FL, PACO xác định phiên bản, OCR, analytics/lakehouse, tuyến chuỗi lạnh đầy đủ |
| 7 | Governance, search, observability | Metadata, keyword + semantic retrieval, logs, audit | Data catalog/lineage hệ thống, metrics dashboard, vector/search service chuyên dụng |

Các hãng/công nghệ trong bảng đề là tham khảo. Có thể chọn công nghệ khác cho vai trò tương đương, nhưng cấu hình một container chưa chứng minh vai trò đã được tích hợp. Bảy lớp này cũng khác với bảy nhóm dịch vụ Tầng 1 ở phần §2.

## Bảy nhóm dịch vụ lõi — §2, trang 2–3

| Nhóm | Hiện tại |
|---|---|
| Identity/security | OIDC, role, tenant; phần PKI/HSM/MFA/secrets và kiểm dịch chưa có |
| Multi-tenancy/edge/localization | Query lấy tenant từ danh tính ký; tiếng Việt; PII/edge chưa có |
| Structured data | OLTP cục bộ, optimistic versions; lô FEFO, in-transit, time series telemetry mẫu; chưa semantic entity broker |
| Unstructured data/files/records/reports | SOP văn bản có metadata và embedding; chưa object storage/report templates |
| BPMN/workflow/serverless/ingestion | BPMN user/service tasks và input API; chưa ingestion bulk/serverless |
| Operations/audit/streaming/GitOps/recovery | Audit transaction + request logs + SSE replay; broker/GitOps/restore toàn hệ thống chưa có |
| Communications/realtime/queues/nonrepudiation | SSE realtime và replay theo tenant, fallback 30 giây; queue/nonrepudiation chưa có |

## Bốn nguyên lý thiết kế

- Hot/cold lifecycle: hiện chỉ OLTP; chưa lakehouse và retention.
- IT + OT: minh họa qua nhiệt độ nhập tay → cách ly tự động; chưa Digital Twin cảm biến thật.
- Provenance/quality: mỗi quyết định giữ nguồn phiên bản, tài liệu/embedding giữ ID và version, cold chain có nguồn mô phỏng và audit. Chưa lineage/catelog xuyên hệ thống.
- Zero Trust/GitOps/recovery: đã có kiểm tra danh tính/quyền ở server; chưa hoàn thiện mTLS, secret management, quarantine files, immutable deployments và khôi phục có kiểm chứng.

## Bốn module ý tưởng từ ảnh người dùng

| Module | Hiện tại | Bước còn lại |
|---|---|---|
| Forecasting | Baseline 7 ngày, nhu cầu/mức phủ có phương pháp rõ | Huấn luyện per-chain, FL thật, dữ liệu train/test và benchmark |
| Decision | Nhập/nhận lô mới, giảm giá, FEFO điều chuyển; BPMN, xuất/nhận/hủy và audit | Tối ưu chi phí/hủy hàng, partial receipt, returns/sales/disposal/recall đầy đủ |
| Routing | Pickup–delivery greedy, giới hạn tải và thời gian, lý do unassigned | PACO chưa xác định repo/version; tủ lạnh/VRP/cold telemetry |
| Agent | Giải thích 5 mục + RAG/Ollama cục bộ, kiểm tra token số | Hiệu chuẩn chất lượng, OCR, quản lý vòng đời agents và kiểm tra dữ kiện/đơn vị sâu hơn |

## Hạng mục cần ưu tiên tiếp

1. Phần còn thiếu của lifecycle: nhận từng phần, bán/hủy hàng, hoàn trả và thu hồi; forecast dựa lô đủ điều kiện thay cho cutoff tổng bảo thủ.
2. Nâng cấp workflow đa dịch vụ và version/migration definitions, hợp đồng API ổn định; BPMN local đã chạy.
3. Object storage + malware quarantine + version/retention và khôi phục.
4. Event broker/outbox phân tán và NGSI-LD/OT thật; 3D đã nối trạng thái OLTP/SSE hiện tại.
5. Federation có worker riêng mỗi chuỗi, payload model update và kiểm chứng không gửi dữ liệu thô; chưa đồng nghĩa không rò rỉ thông tin.
6. Xác định PACO đúng nguồn, bổ sung cold locker constraints và baseline/benchmark.
7. Lakehouse, lineage/catalog, metrics/GitOps/backup restore; kiểm chứng từng vai trò bằng luồng thực.

PDF có tiêu đề OLP 2026 nhưng một mốc nộp ghi năm 2025; cần nguồn chính thức xác nhận khi chuẩn bị nộp. Không suy diễn ảnh ý tưởng MLAI Hackathon là tên cuộc thi hiện tại.

## Đối chiếu nguồn và lựa chọn đợt 2

Agent nghiên cứu tải lại PDF từ Drive ngày 14/10/2026: SHA256 `ed57bb280ae3cad2ae7f1ff9b4c00ab3c8d0b6d4138d8e19f90ab5ef5fe24393`, khớp byte PDF gốc và văn bản. Chọn bpmn-engine theo quyền chọn công nghệ ở §4, thay cho thêm service Flowable Java trong đợt này. Hợp đồng engine/recovery được kiểm chứng theo [API chính thức](https://github.com/paed01/bpmn-engine/blob/master/docs/API.md) và [ví dụ](https://github.com/paed01/bpmn-engine/blob/master/docs/Examples.md), không coi hình vẽ quy trình là engine đã tích hợp.
