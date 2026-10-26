# KhoSpace

Mô phỏng kho vận 3D theo `/home/chinhan/projects/file.md`, với dữ liệu và hình khối tự dựng. Bản đồ phủ toàn màn hình; thông tin chỉ mở khi cần theo yêu cầu giao diện ít chữ.

## Chạy

```bash
cd /home/chinhan/projects/waretrack
npm install
npm run dev
```

Mở http://localhost:5180. `npm run build` kiểm tra TypeScript và tạo bản dựng; `npm run preview` phục vụ bản dựng trên cùng cổng (dừng dev trước).

## Sử dụng

- Kéo chuột trái để di chuyển, chuột phải để xoay, cuộn để thu phóng. Cột nút bên phải hỗ trợ zoom, xoay và đặt lại camera.
- Chuyển giữa năm địa điểm bằng bộ chọn trên cùng hoặc điểm đánh dấu trong bản đồ; camera di chuyển tới tọa độ địa điểm.
- Bấm đối tượng để mở thông tin. Tìm kiếm bằng nút kính lúp hoặc `/`; `Esc` đóng tìm kiếm, bảng hoặc bỏ chọn. Đội vận hành và bộ chọn đối tượng hỗ trợ truy cập bằng bàn phím.
- Thanh công cụ dưới mở lần lượt: dừng/chạy, trong kho, thông tin, đội vận hành, hành trình, chỉ số và cài đặt. Mỗi lần chỉ mở một bảng.
- Cài đặt chứa tốc độ 1/6/12/24×, chất lượng đồ họa, nhãn bản đồ, tồn kho, lô hàng và hướng dẫn. Nhãn tĩnh mặc định ẩn; đối tượng được chọn hoặc hover vẫn có nhãn.
- Xe tải vào hàng đợi, tiến tới điểm quay, dừng rồi lùi vào cửa kho. Xe nâng tăng/giảm tốc, xoay về hướng chạy, lấy và giao từng pallet, đi tới trạm trước khi sạc. Pallet được chở đi cùng xe nâng và vẫn chọn được.

## Mô phỏng

Engine thuần TypeScript bước một giây mô phỏng. Renderer nội suy vị trí và góc xoay giữa hai trạng thái theo cùng đồng hồ; bánh xe quay theo quãng đường thực sự di chuyển. Tạm dừng giữ nguyên cả vị trí lẫn góc xoay. Thân xe và bánh dùng cùng cây biến đổi; chỉ cảnh tĩnh được gom instance.

Có 5 địa điểm, 19 cửa, 20 xe tải, 15 xe nâng, 120 pallet, 15 trạm sạc, 20 mặt hàng và 20 lô hàng. Tiến độ xe tải tăng khi xe nâng giao hàng thực sự; tồn kho, trạng thái hàng và mốc lô hàng cập nhật cùng engine. Dữ liệu nằm trong bộ nhớ, tải lại trang sẽ đặt lại. Chu kỳ demo tái sử dụng danh tính xe/lô/pallet; không phải sổ kho sản xuất.

## Kiểm tra

```bash
npm test
npm run test:e2e
```

Vitest kiểm tra tính nhất quán, chuyển trạng thái, giới hạn bước di chuyển và góc xoay, đường đi sạc và vị trí hàng không chồng nhau qua 30 phút mô phỏng. Playwright kiểm tra chọn trong cảnh, tìm kiếm, năm địa điểm, bảng dữ liệu, xuất CSV, focus bàn phím, các chiều rộng 390/768/1920 và chuyển động/dừng ở các frame thực tế.

## Giới hạn

Cần WebGL. Chất lượng tự hạ DPR khi FPS thấp; có chế độ tiết kiệm GPU. Chưa bảo đảm 60 FPS trên mọi thiết bị. Đường chạy theo kịch bản, chưa có bộ giải va chạm và giao thông đầy đủ. Chưa kết nối WMS/API thực, đăng nhập hoặc lưu trạng thái máy chủ.
