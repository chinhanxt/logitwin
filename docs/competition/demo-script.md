# Kịch bản trình bày 15 phút

**0–2 phút:** Bài toán hàng tươi: nhập dư → hủy, nhập thiếu → mất đơn; hàng đang có ở nơi khác nhưng chưa thể điều chuyển có kiểm soát. Tên dự án chưa chốt. Chọn không gian [I] Intelligence của HPDI.

**2–4 phút:** Mở “Kiến trúc 7 lớp”. Nói ba tầng trước: lõi headless, cổng HPDI, module Logistics. Sau đó lần lượt bảy lớp: trải nghiệm; biên/định danh/bảo mật; nghiệp vụ/trạng thái; automation/workflow; streaming/lakehouse/ledger; phân tích/trí tuệ; quản trị/tìm kiếm/quan sát. Chỉ ra thành phần thực sự chạy và phần còn thiếu trong mỗi lớp.

**4–8 phút:** Đăng nhập Người lập, phân tích tồn kho, mở đề xuất 5 mục. Sang tài khoản phê duyệt khác, duyệt và thực thi. Mở Vận hành 3D, chọn lệnh chuyển. Giải thích giữ hàng không thay đổi tồn vật lý; xuất giao giảm nguồn và tăng lượng đang đi; nhận hàng tăng đích. Tài khoản khác cập nhật qua SSE. Xem checkpoint BPMN đang chờ nhận và lô nguồn được giữ nguyên. Đơn mua chưa cộng tồn. Mở audit chứng minh các bước được ghi cùng giao dịch.

Trong cảnh **Kho chi tiết**, mở mái để thấy kệ API, chọn xe để ra lệnh qua inspector và đổi sang **Mạng lưới** để xem nguồn–đích. Dừng/chạy hình 3D để chứng minh thao tác trình diễn không đổi tồn hay workflow; xe tải chạy theo trạng thái `in_transit`, xe nâng/sân/cửa là minh họa. Không gọi đường chuyển động là GPS hoặc sáu cửa hình học là số cửa kho thực. Đây là UI Tầng 2 dùng API; engine và kiểm tra nghiệp vụ vẫn headless ở lõi.

**8–10 phút:** Dùng bản đọc nhiệt độ mô phỏng vượt ngưỡng để thấy core tự cách ly. Giải thích chính sách mẫu, chưa có cảm biến thật. Người phê duyệt kiểm tra và giải phóng; không coi nhiệt độ bình thường là bằng chứng chất lượng tự động.

**10–12 phút:** Tra cứu SOP qua AI. Chỉ model cục bộ, đoạn nguồn và phiên bản. Nói rõ token số được đối chiếu nhưng chưa chứng minh mọi ý nghĩa đúng; agent không thực thi lệnh. Đề xuất nghiệp vụ vẫn tính bằng logic xác định.

**12–13 phút:** Xem trước tuyến điều chuyển, hạ sức chứa hoặc thời gian để thấy unassigned. Đây là baseline greedy, chưa PACO/tủ lạnh.

**13–15 phút:** Trình bày kết quả kiểm thử, source/build receipt và kế hoạch ưu tiên. Không gọi hash chain là ledger bất biến, sơ đồ/3D là Digital Twin thật, hoặc container config là chức năng đã hoàn thành. Chốt bằng một vấn đề cụ thể còn cần giải quyết: nối dữ liệu lô/OT và workflow nguồn mở vào luồng hiện tại.
