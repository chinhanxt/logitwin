export function seedRows(tenant: string) {
  const expiry = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const stores = [
    { id: "q1", lat: 10.776, lng: 106.7 },
    { id: "q3", lat: 10.784, lng: 106.684 },
    { id: "q7", lat: 10.735, lng: 106.721 },
  ];
  const products = [
    { id: "salad", name: "Rau salad hữu cơ", unit: "gói", price: 32000, stock: [92, 8, 28], history: [12, 14, 13, 15, 16, 14, 14], days: 3 },
    { id: "milk", name: "Sữa tươi thanh trùng", unit: "hộp", price: 28000, stock: [20, 40, 5], history: [10, 9, 12, 11, 13, 12, 10], days: 6 },
    { id: "berry", name: "Dâu tây Đà Lạt", unit: "hộp", price: 59000, stock: [35, 16, 22], history: [7, 6, 8, 9, 8, 7, 8], days: 1 },
  ];
  return stores.flatMap((s, index) =>
    products.map((p) => ({
      id: `${s.id}-${p.id}`,
      tenant,
      store: s.id,
      product: p.id,
      name: p.name,
      unit: p.unit,
      on_hand: p.stock[index],
      reserved: 0,
      price: p.price,
      expires: expiry(p.days),
      version: 1,
      history: p.history.map((v, i) => Math.max(1, v + (index === 2 ? -3 : index) + (i % 2))),
      lat: s.lat,
      lng: s.lng,
    })),
  );
}
