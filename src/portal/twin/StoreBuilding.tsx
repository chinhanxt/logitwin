import type { Stock } from "../../core/contracts";
import { storeName } from "../api";
import type { Selection, StoreNode } from "./model";
import { Box, Label } from "./Primitives";

function StockRack({
  stock,
  x,
  z,
  selected,
  labels,
  onSelect,
}: {
  stock: Stock;
  x: number;
  z: number;
  selected: boolean;
  labels: boolean;
  onSelect: (selection: Selection) => void;
}) {
  const color = stock.quality === "hold" ? "#d9958a" : stock.reserved > 0 ? "#e6bb78" : "#79a8d1";
  return (
    <group
      position={[x, 0, z]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect({ kind: "stock", id: stock.id });
      }}
    >
      {[-0.65, 0.65].flatMap((px) =>
        [-0.5, 0.5].map((pz) => <Box key={`${px}-${pz}`} at={[px, 1.3, pz]} size={[0.06, 2.3, 0.06]} color="#5f87af" />),
      )}
      {[0.38, 1.12, 1.85].map((y) => (
        <group key={y}>
          <Box at={[0, y, 0]} size={[1.48, 0.08, 1.2]} color="#bdcede" />
          {[-0.36, 0.36].map((px) => (
            <Box key={px} at={[px, y + 0.23, 0]} size={[0.56, 0.4, 0.68]} color={color} />
          ))}
        </group>
      ))}
      <Box at={[0, 0.09, 0]} size={[1.62, 0.035, 1.35]} color={selected ? "#3189ed" : "#e8eef4"} />
      {selected && labels && (
        <Label
          text={stock.name}
          sub={`${stock.quality === "hold" ? 0 : stock.on_hand - stock.reserved} ${stock.unit} khả dụng`}
          at={[0, 3.1, 0]}
          width={3.5}
        />
      )}
    </group>
  );
}
export default function StoreBuilding({
  node,
  roof,
  selection,
  onSelect,
  labels = true,
}: {
  node: StoreNode;
  roof: boolean;
  labels?: boolean;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
}) {
  const active = selection?.kind === "store" && selection.id === node.id;
  const tone = node.held ? "#ca8276" : "#438dda";
  const displayStocks = node.stocks.slice(0, 12);
  const selectedStock = selection?.kind === "stock" ? node.stocks.find((stock) => stock.id === selection.id) : undefined;
  if (selectedStock && !displayStocks.some((stock) => stock.id === selectedStock.id)) displayStocks.splice(11, 1, selectedStock);
  return (
    <group position={node.position}>
      <group
        onClick={(event) => {
          event.stopPropagation();
          onSelect({ kind: "store", id: node.id });
        }}
      >
        <Box at={[0, 0.04, 0]} size={[11.2, 0.28, 8.5]} color={active ? "#b9d9fb" : "#e4edf5"} />
        <Box at={[0, 0.24, 0]} size={[10, 0.14, 7]} color="#f9fbfd" />
        <Box at={[0, 1.8, -3.4]} size={[10, 3.05, 0.16]} color="#edf3f8" />
        <Box at={[-4.9, 1.8, 0]} size={[0.16, 3.05, 7]} color="#edf3f8" />
        <Box at={[4.9, 1.8, -1.9]} size={[0.16, 3.05, 3.15]} color="#e6eef6" />
        <Box at={[0, 3.1, 3.45]} size={[10, 0.45, 0.16]} color="#ffffff" />
        <Box at={[0, 3.12, 3.57]} size={[10, 0.17, 0.08]} color={tone} />
        {[-4.82, -1.6, 1.6, 4.82].map((x) => (
          <Box key={x} at={[x, 1.67, 3.4]} size={[0.15, 2.85, 0.17]} color="#f8fbfe" />
        ))}
        {[-3.2, 0, 3.2].map((x) => (
          <group key={x}>
            <Box at={[x, 0.25, 3.92]} size={[2.6, 0.17, 1.1]} color="#9aadc1" />
            <Box at={[x, 1.68, 3.42]} size={[2.7, 2.45, 0.1]} color="#b0c9e0" opacity={roof ? 1 : 0.17} />
            {Array.from({ length: 7 }, (_, i) => (
              <Box key={i} at={[x, 0.62 + i * 0.3, 3.5]} size={[2.68, 0.025, 0.025]} color="#b9cedf" />
            ))}
            <Box at={[x, 0.51, 3.55]} size={[2.4, 0.1, 0.03]} color="#6b88a7" />
          </group>
        ))}
        {[
          [-3.7, -2.8],
          [3.7, -2.8],
        ].map(([x, z], i) => (
          <group key={i}>
            <Box at={[x, 3.52, z]} size={[0.8, 0.46, 0.7]} color="#dae5ee" />
            <Box at={[x, 3.8, z]} size={[0.65, 0.06, 0.57]} color="#a9bdcf" />
          </group>
        ))}
        {roof && (
          <group>
            <Box at={[0, 3.4, 0]} size={[10.35, 0.2, 7.5]} color="#fbfdff" />
            {[-2.35, 0, 2.35].map((x) => (
              <Box key={x} at={[x, 3.52, -0.35]} size={[1.55, 0.03, 4.5]} color="#c6dfed" />
            ))}
            <Box at={[0, 3.46, 3.72]} size={[10.4, 0.25, 0.09]} color="#dce8f3" />
          </group>
        )}
        <Box at={[-4.15, 0.95, 2.25]} size={[1.1, 1.5, 1.8]} color={node.held ? "#f3dcd7" : "#d8eee9"} />
        <Box at={[-4.15, 1.08, 3.18]} size={[0.8, 0.8, 0.015]} color={node.held ? "#c68479" : "#89b5a7"} />
        {[-1.9, 0, 1.9].map((x) => (
          <Box key={x} at={[x, 0.33, -0.05]} size={[0.05, 0.02, 4.8]} color="#cfddea" />
        ))}
      </group>
      {!roof &&
        displayStocks.map((stock, index) => (
          <StockRack
            key={stock.id}
            stock={stock}
            x={-2.7 + (index % 4) * 1.8}
            z={-2.1 + Math.floor(index / 4) * 1.75}
            selected={selection?.kind === "stock" && selection.id === stock.id}
            labels={labels}
            onSelect={onSelect}
          />
        ))}
      {labels && (
        <Label
          text={storeName(node.id)}
          sub={`${node.stocks.length} dòng hàng${node.held ? ` · ${node.held} cách ly` : ""}`}
          at={[0, 4.7, -0.7]}
          width={6.3}
          color={tone}
        />
      )}
      {labels && node.reading && (
        <Label
          text={`${node.reading.temperature / 100}°C · bản đọc mẫu`}
          sub={`${node.reading.source} · ${new Date(node.reading.created_at).toLocaleTimeString("vi-VN")}`}
          at={[-3.5, 2.8, 4.5]}
          width={3.7}
          color={tone}
        />
      )}
      {labels && <Label text="NHẬN HÀNG" at={[0, 0.43, 5.1]} width={2.7} background="#f7fafc" color="#8da4ba" />}
    </group>
  );
}
