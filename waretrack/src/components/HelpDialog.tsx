import { IconArrowUpRight, IconBuildingWarehouse, IconPlayerPause, IconRotate, IconSearch, IconX } from "@tabler/icons-react";
export default function HelpDialog({ close }: { close: () => void }) {
  return (
    <div className="drawer-backdrop" onClick={close}>
      <section className="help-dialog" role="dialog" aria-modal="true" aria-label="Hướng dẫn sử dụng" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">
          <h2>Khám phá không gian kho</h2>
          <button className="icon-button" aria-label="Đóng hướng dẫn" onClick={close}>
            <IconX size={20} />
          </button>
        </div>
        <p>Một góc nhìn trực quan về mọi hoạt động trong kho.</p>
        <ul>
          <li>
            <IconRotate size={22} />
            <div>
              <strong>Xoay và di chuyển</strong>
              <span>Kéo chuột trái để di chuyển, chuột phải để xoay. Trên điện thoại, dùng hai ngón để di chuyển và thu phóng.</span>
            </div>
          </li>
          <li>
            <IconSearch size={22} />
            <div>
              <strong>Khám phá từng đối tượng</strong>
              <span>Chọn xe, xe nâng, cửa kho hoặc mở “Trong kho” để chọn kệ hàng.</span>
            </div>
          </li>
          <li>
            <IconBuildingWarehouse size={22} />
            <div>
              <strong>Chuyển giữa năm địa điểm</strong>
              <span>Dùng bộ chọn địa điểm hoặc các nút 01 đến 05 trên bản đồ.</span>
            </div>
          </li>
          <li>
            <IconPlayerPause size={22} />
            <div>
              <strong>Làm chủ nhịp vận hành</strong>
              <span>Tạm dừng mô phỏng để xem dữ liệu. Đồng hồ mặc định chạy nhanh 12 lần. Phím / tìm kiếm, Esc bỏ chọn.</span>
            </div>
          </li>
        </ul>
        <div className="help-note">Đây là bản mô phỏng tương tác, chưa kết nối hệ thống quản lý kho thực tế.</div>
        <button className="button primary" onClick={close}>
          Bắt đầu khám phá <IconArrowUpRight size={17} />
        </button>
      </section>
    </div>
  );
}
