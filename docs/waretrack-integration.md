# WareTrack vào DX-OS Logistics

Người dùng yêu cầu ghép giao diện 3D và chuyển động của `/home/chinhan/projects/waretrack` vào DX-OS, giữ tone trắng sáng và kiến trúc đề thi. Bản ghép nằm trong cùng portal tại `http://127.0.0.1:5190`, dùng danh tính, tenant, tồn/lô, quyết định, lệnh và BPMN của DX-OS.

## Phần đã ghép

- Geometry kho lớn, mái xanh/skylight, văn phòng, sáu cửa, kệ, sân/đường/cây/container, xe tải và xe nâng từ source WareTrack. Camera orthographic, xoay, góc trên, fit theo viewport và chuyển góc êm.
- `src/portal/waretrack`: geometry được tách khỏi Zustand/seed/timer cũ; mô hình nhận dữ liệu và ID của API. Nhãn DOM chiếu từ WareTrack dùng `textContent`, cleanup khi unmount, không tạo nested React roots.
- `Kho chi tiết` hiển thị một cửa hàng; chọn stock/movement tự chọn cửa hàng liên quan. Kệ, cửa và xe dùng cùng lựa chọn; lệnh được chọn ưu tiên khi số đối tượng vượt giới hạn cảnh.
- `Mạng lưới` giữ sơ đồ các cửa hàng và liên kết điều chuyển. Xe `in_transit` chạy trên đường trình diễn khép kín, không nhảy về điểm đầu mỗi vòng.
- Tạm dừng/chạy, ẩn nhãn, giảm chuyển động hệ điều hành, ngừng animation khi tab ẩn, fullscreen, dropdown bàn phím và bảng fallback không có WebGL.

## Quyền và dữ liệu

Xe chỉ gắn với lệnh thực từ API của tenant. `reserved` đứng chờ, `in_transit` chuyển động, `ordered` ở sân, `received` đứng nhận và `cancelled` bỏ khỏi cảnh. Hai xe nâng là chuyển động minh họa, không phải tài sản hoặc vị trí cảm biến đã kết nối. Dừng/chạy không gọi API để thay đổi nghiệp vụ.

Xuất và nhận vẫn phải có quyền, trạng thái hợp lệ, lô đủ điều kiện và bản đọc nhiệt độ mới. Thao tác đi qua gateway/lõi, BPMN/checkpoint/audit commit cùng transaction; SSE cập nhật portal khác. Lõi Tầng 1 không có UI mới. Cảnh thuộc portal Tầng 2 [I]; dữ liệu Logistics thuộc Tầng 3. Bảy lớp công nghệ và các phần còn thiếu vẫn ở `competition/requirements.md`.

Kích thước hình học, sáu cửa, số kiện vẽ, xe nâng và đường chạy là bố trí trình diễn. Không có GPS, dock occupancy, công suất kho, tài xế, biển số, pin, ETA hoặc cảm biến thật được suy diễn từ geometry. Không nhập các con số/trạng thái giả của WareTrack. Bảng/dropdown giữ mọi dòng API; cảnh kho giới hạn 12 kệ và 10 lệnh, mạng lưới giới hạn 8 lệnh.

## Phân công

| Agent | Phạm vi | Checkout |
|---|---|---|
| `/root/waretrack_assets` | Geometry từ WareTrack | `var/workspaces/waretrack-merge/warehouse-assets` |
| `/root/waretrack_motion` | Motion thuần, xe API, kiểm thử motion | `var/workspaces/waretrack-merge/warehouse-motion` |
| `/root/merge_review` | Đọc brief/code, rà sự nhất quán và camera | Chỉ đọc |
| `/root` | Ghép, camera/network, portal, dữ liệu test, trình duyệt và receipt | Main checkout |

Không có hai writer trong main checkout. Không thêm dependency/secret và không commit/push/publish. WareTrack gốc được giữ để tham chiếu. Source hash gốc trong `waretrack-integration-decision.json`; source/build/artifact và kết quả cuối trong `waretrack-integration-validation.json`.

## Kiểm chứng

Test motion kiểm tra tuyến khép kín/vị trí/góc liên tục, thời gian dừng, reduced motion, giới hạn bước sau tab nền, tenant/store scope, ưu tiên đối tượng, cap/chỗ đỗ và bất biến dữ liệu API sau nhiều frame. E2E dùng lệnh `in_transit` do lõi phát hành thật, so ảnh chạy/dừng và số lệnh vẽ WebGL lúc idle; kiểm tra camera focus/góc trên dừng hẳn. Vì screenshot cuộn Canvas vào vùng xem có thể gây ResizeObserver invalidation, phép đo idle thực hiện trước screenshot.

Kiểm thử xuất/nhận dùng hai tài khoản Keycloak, đối chiếu tồn nguồn/đích và checkpoint, SSE sang tài khoản khác, reduced motion, desktop/mobile và không gọi dữ liệu ngoài localhost. Kiểm tra browser riêng cho fullscreen, chọn stock và fallback không có WebGL. Các luồng ghi dùng database test riêng; fingerprint dữ liệu nghiệp vụ của `var/core.sqlite` được đối chiếu trước và sau khởi động lại runtime bình thường.
