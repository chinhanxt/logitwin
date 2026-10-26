# DX-OS Logistics Intelligence

Tên kỹ thuật tạm thời; chưa chốt tên sản phẩm. Portal phục vụ không gian **[I] Intelligence** của HPDI, sử dụng lõi headless và module nghiệp vụ Logistics.

## Mở bản đang chạy

Portal: **http://127.0.0.1:5190**. Dùng địa chỉ này để callback SSO khớp cấu hình.

Chọn **Đăng nhập qua Keycloak**. Ba tài khoản `planner`, `approver`, `viewer` có mật khẩu ngẫu nhiên trong file riêng tư `../var/identity.json`, mục `users`. File còn chứa client secret; không đưa file này lên Git hoặc vào slide. Xem tài khoản bằng editor trên máy của bạn.

- `planner`: phân tích, thêm SOP, lập chỉ mục AI, nhập bản đọc nhiệt độ mô phỏng.
- `approver`: duyệt/từ chối, thực thi, xác nhận nhận hàng, xác nhận kiểm tra chất lượng.
- `viewer`: xem dữ liệu, tra cứu SOP và xem trước tuyến.

Phiên cổng hết hạn cùng ID token. Đăng xuất cổng xóa phiên ứng dụng; phiên nhà cung cấp định danh độc lập. Luồng đăng nhập yêu cầu nhập lại tài khoản để tiện đổi người trong demo.

## Khởi động lại

Node 24.14+, Docker Compose và Ollama đang có `bge-m3:latest`, `gemma2:2b`.

```bash
cd /home/chinhan/projects/dxos-logistics
npm ci
node config/identity-init.mjs
docker compose -f config/compose.yaml up -d
npm run dev
```

Script Identity bảo toàn cấu hình đã có. Realm chỉ import khi chưa tồn tại; thay đổi JSON import không tự thay đổi realm đang lưu trong volume.

Dịch vụ chỉ bind loopback: portal 5190, core 5191, Keycloak 5192, gateway 5193. Keycloak dùng chế độ development và volume riêng. Không dùng cấu hình này để triển khai public.

## Demo một luồng

1. Người lập chọn **Phân tích dữ liệu**. Lõi đọc tồn kho, tính baseline nhu cầu 7 ngày và sinh nhập hàng/giảm giá/điều chuyển.
2. Mở một đề xuất trong **Quyết định**. Xem đủ năm mục: đề xuất, lý do, độ tin cậy, giả định, việc cần duyệt.
3. Đăng nhập bằng tài khoản phê duyệt trong cửa sổ riêng. Duyệt rồi chọn **Thực thi ở lõi**.
4. Điều chuyển đã thực thi giữ hàng tại nguồn. **Xuất giao** giảm tồn nguồn và đưa lượng hàng vào trạng thái đang vận chuyển; **Xác nhận đã nhận** mới tăng tồn đích. Cả hai bước cần bản đọc nhiệt độ mẫu nguồn/đích trong ngưỡng ở 5 phút gần nhất. Nhập hàng tạo đơn mua; **Nhận lô nhập** với mã lô/hạn dùng/số lượng mới tăng tồn.
5. **Lộ trình giao hàng** xem trước các lệnh điều chuyển đang giữ hàng. Giới hạn tải xe và thời gian có kiểm tra; lệnh không phù hợp có lý do riêng.
6. **Tri thức vận hành** thêm SOP; **Trợ lý Intelligence** lập chỉ mục và đặt câu hỏi. Embedding và LLM chạy trên Ollama cục bộ. Câu trả lời kèm nguồn, phiên bản và năm mục.
7. **Giám sát chuỗi lạnh** nhập bản đọc 12°C để thấy cách ly; nhập lại 5°C vẫn giữ cách ly. Người phê duyệt ghi lý do kiểm tra để giải phóng, với bản đọc trong ngưỡng ở 5 phút gần nhất. Đây là cảm biến mô phỏng và chính sách ngưỡng mẫu.
8. **Vận hành 3D** mặc định mở **Kho chi tiết**: khuôn viên, mái, cửa hàng, sân, xe tải và xe nâng được ghép từ WareTrack. Đổi cửa hàng để xem dòng tồn đúng API; chọn kệ sẽ mở mái. Chuyển sang **Mạng lưới** để xem quan hệ nguồn–đích. Chọn lệnh để xem lô FEFO, checkpoint BPMN và xuất/nhận qua API; SSE cập nhật tài khoản khác trong cùng chuỗi. Nút dừng/chạy chỉ điều khiển hình 3D; tùy chọn giảm chuyển động của hệ điều hành được tôn trọng. Có góc trên, xem gần, thu/phóng, ẩn nhãn và toàn màn hình.
9. Xem **Nhật ký workflow** và **Kiến trúc 7 lớp** để đối chiếu hành động với bằng chứng triển khai.

Nếu tồn kho đổi sau khi đề xuất được tạo, lõi báo stale. Từ chối/hủy đề xuất cũ trước khi phân tích lại. Không sửa tồn kho để ép đề xuất cũ chạy.

## Cấu trúc

- `src/core`: định danh, API, repository, audit, BPMN/checkpoint, SSE, tài liệu và RAG — không cung cấp UI.
- `src/modules/logistics`: forecast, quyết định, điều chuyển, routing và chính sách chuỗi lạnh.
- `src/portal`: Tầng 2 Intelligence, mọi thay đổi nghiệp vụ gọi API.
- `src/gateway.ts`: gateway development độc lập, upstream cố định, giới hạn body/tần suất và timeout.
- `config`: khởi động, Keycloak, BPMN XML cố định/versioned, kiểm thử và kiểm chứng mô hình.
- `var`: dữ liệu SQLite và cấu hình bí mật; bị gitignore.
- `tests`: phân quyền, tenant, transaction, persistence, workflow, RAG, routing và trình duyệt.

## Kiểm chứng

```bash
npm run build
npm test
npm run test:e2e
node --experimental-strip-types config/check-ai.ts
```

E2E cần stack đang chạy và cấu hình Identity. Dữ liệu local demo có thể được thay đổi bởi E2E. Unit/integration nghiệp vụ dùng database riêng và kiểm thử bảo toàn tồn kho, stale, idempotency, cách ly, tenant, giới hạn RAG và lưu bền khi mở lại database.

## Giới hạn hiện tại

Dữ liệu vẫn là mẫu. Đã có bảng lô, cấp phát FEFO, provenance nguồn–đích, nhận đơn mua với lô mới và hủy lệnh chưa xuất giao. Mỗi dòng tồn vẫn có số tổng và ngày hết hạn sớm nhất của các lô còn hàng; nguồn dữ liệu cũ được gắn nhãn legacy, không suy diễn chứng từ lịch sử. Forecast dùng ngày tổng một cách bảo thủ nên có thể bỏ qua cả dòng còn lô mới khi một lô cũ hết hạn. Chưa có bán/xử lý hủy hàng/thu hồi/hoàn trả hoặc nhận từng phần. Ngày hết hạn dùng cutoff UTC hiện tại. Lệnh đang vận chuyển không hủy trực tiếp.

Forecast dùng trung bình mẫu, chưa có FL và chưa có đo chất lượng dự báo. Routing greedy theo khoảng cách ước tính, chưa có PACO, tối ưu VRP, tủ lạnh hoặc dữ liệu giao thông. Telemetry nhập tay, chưa kết nối cảm biến thật/NGSI-LD.

RAG dùng cosine trên vector lưu trong SQLite, tối đa ba tài liệu mới mỗi lần lập chỉ mục và tối đa 50 tài liệu được xét mỗi đợt. Ngưỡng liên quan 0,35 là heuristic chưa hiệu chuẩn. Kiểm tra token số chỉ so chữ số có dấu với nguồn được trích; không chứng minh đơn vị, quan hệ hay mọi kết luận đều đúng. LLM không được thực thi nghiệp vụ; lỗi kết quả sẽ trả đoạn nguồn hoặc lỗi dịch vụ có kiểm soát. Tổng thời gian mỗi thao tác AI tối đa 50 giây; tối đa hai thao tác đồng thời.

BPMN dùng bpmn-engine 26.0.5 với definition cố định. Engine chuẩn bị lệnh/checkpoint; domain mutation, checkpoint và audit commit trong cùng giao dịch SQLite. Checkpoint pin engine/definition hash, mismatch phiên bản sẽ dừng để nâng có kiểm soát. SSE phát lại event đã commit theo tenant, có cursor và đóng khi hết phiên; chưa phải event broker/distributed queue. Chưa có Lakehouse, sổ cái bất biến, catalog, OCR, WAF, malware quarantine, MFA và GitOps/khôi phục toàn hệ thống có kiểm chứng. Đây là bản phát triển chạy xuyên suốt, chưa phải bản hoàn thành toàn bộ đề thi. Xem [ma trận yêu cầu](competition/requirements.md).

Không gian WareTrack đã tích hợp trực tiếp vào portal và dữ liệu lõi. Chỉ xe của lệnh API `in_transit` chạy; lệnh đã giữ/đã nhận đứng tại cửa minh họa, đơn mua ở sân chờ, lệnh hủy không có xe. Hai xe nâng chạy minh họa trên sân, kể cả khi chưa có lệnh. Không nhập bộ timer WareTrack cũ tự tăng tiến độ, đổi lệnh hoặc cộng tồn. Các kệ/xe/đường là hình minh họa, không là GPS/cảm biến thật và không quy đổi mỗi hình hộp thành đơn vị hàng hoặc kích thước kho thực. Tối đa 12 dòng tồn mỗi cửa hàng, 10 lệnh tại khuôn viên và 8 trong mạng lưới; chọn đối tượng ưu tiên hiển thị nó, bảng/dropdown giữ toàn bộ API. Có chọn bằng bàn phím và fallback khi không có WebGL. Mã nguồn WareTrack gốc được giữ tại `/home/chinhan/projects/waretrack`; ứng dụng ghép chạy ở cổng 5190.

Xem [hồ sơ ghép WareTrack](waretrack-integration.md), [kiểm chứng bản ghép](waretrack-integration-validation.json), [hồ sơ phát triển nhóm](development-round-2.md) và [ảnh kho đang vận chuyển](waretrack-merged-in-transit.png).
