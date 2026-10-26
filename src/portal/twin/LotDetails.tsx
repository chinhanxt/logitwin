import type { Movement, Stock } from "../../core/contracts";
// These optional projections keep the portal compatible while the core lot migration is integrated.
interface LotView {
  id: string;
  batch_id: string;
  expires: string;
  on_hand: number;
  reserved: number;
  origin_stock: string;
  origin_batch: string;
}
interface AllocationView {
  source_lot: string;
  batch_id: string;
  expires: string;
  quantity: number;
  origin_stock: string;
  origin_batch: string;
}
export function StockLots({ stock }: { stock: Stock }) {
  const lots = (stock as Stock & { lots?: LotView[] }).lots;
  if (!lots?.length) return null;
  return (
    <>
      <h3 className="twin-section-title">Lô vật lý · thứ tự hạn dùng</h3>
      <div className="twin-lots">
        {[...lots]
          .sort((a, b) => a.expires.localeCompare(b.expires) || a.id.localeCompare(b.id))
          .map((lot) => (
            <article key={lot.id}>
              <div>
                <strong>{lot.batch_id}</strong>
                <span>
                  {lot.on_hand - lot.reserved} {stock.unit} khả dụng
                </span>
              </div>
              <small>
                HSD {lot.expires} · {lot.reserved} {stock.unit} đã giữ
              </small>
              <small>
                Nguồn gốc: {lot.origin_stock} / {lot.origin_batch}
              </small>
            </article>
          ))}
      </div>
    </>
  );
}
export function MovementLots({ movement, unit }: { movement: Movement; unit: string }) {
  const lots = (movement as Movement & { lots?: AllocationView[] }).lots;
  if (!lots?.length) return null;
  return (
    <>
      <h3 className="twin-section-title">Phân bổ lô theo FEFO</h3>
      <div className="twin-lots">
        {lots.map((lot) => (
          <article key={lot.source_lot}>
            <div>
              <strong>{lot.batch_id}</strong>
              <span>
                {lot.quantity} {unit}
              </span>
            </div>
            <small>HSD {lot.expires} · ưu tiên hết hạn trước</small>
            <small>
              Nguồn gốc: {lot.origin_stock} / {lot.origin_batch}
            </small>
          </article>
        ))}
      </div>
    </>
  );
}
