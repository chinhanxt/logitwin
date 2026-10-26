// Building/rack geometry adapted from WareTrack. Nodes, stocks and movement selection come from the DX-OS API.
import type { Movement } from "../../core/contracts";
import { storeName } from "../api";
import type { Selection, StoreNode } from "../twin/model";
import { Block, Label, Pallet, SelectionRing } from "./Primitives";
import { movementVehicles } from "./motion";
import { ScreenLabel } from "./ScreenLabel";

export const dockXs = [-8.25, -4.95, -1.65, 1.65, 4.95, 8.25];
export interface WarehouseBuildingProps {
  node: StoreNode;
  roof: boolean;
  labels: boolean;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
  movements?: Movement[];
}

export function WarehouseBuilding({ node, roof, labels, selection, onSelect, movements = [] }: WarehouseBuildingProps) {
  // Docks and parked trucks share a presentation assignment; there is no sensor-based dock occupancy.
  const vehicles = movementVehicles({ stocks: node.stocks, movements }, node.id, 10, selection?.kind === "movement" ? selection.id : undefined);
  const associated = dockXs.map(
    (x) => vehicles.find((vehicle) => !vehicle.moving && vehicle.pose.position[0] === x && vehicle.pose.position[2] === 4.8)?.movement,
  );
  const selectedStock = selection?.kind === "stock" ? node.stocks.find((stock) => stock.id === selection.id) : undefined;
  const shownStocks = node.stocks.slice(0, 12);
  if (selectedStock && !shownStocks.some((stock) => stock.id === selectedStock.id)) shownStocks.splice(11, 1, selectedStock);
  const accent = "#4778e7";
  return (
    <group>
      <group
        onClick={(event) => {
          event.stopPropagation();
          onSelect({ kind: "store", id: node.id });
        }}
      >
        <Block position={[0, 0.2, -4]} size={[21, 0.4, 12]} color="#e4e9ee" />
        <Block position={[0, 2.4, -9.7]} size={[20.4, 4.6, 0.3]} color="#e8eef5" />
        <Block position={[-10.1, 2.4, -4]} size={[0.3, 4.6, 11.5]} color="#f7f9fc" />
        <Block position={[10.1, 2.4, -4]} size={[0.3, 4.6, 11.5]} color="#dfe8f3" />
        <Block position={[0, 4.15, 1.7]} size={[20.4, 1.1, 0.3]} color="#eef2f8" />
        <Block position={[0, 3.73, 1.91]} size={[20.6, 0.18, 0.2]} color={accent} />
        {Array.from({ length: 7 }, (_, i) => (
          <Block key={i} position={[-10 + i * 3.33, 1.9, 1.72]} size={[0.55, 3.7, 0.38]} color="#edf2f8" />
        ))}
        {[-8, -4, 0, 4, 8].map((x) => (
          <group key={x}>
            <Block position={[x, 3.4, -9.49]} size={[2.6, 0.75, 0.08]} color="#aed0e0" />
            <Block position={[x, 3.4, -9.43]} size={[0.05, 0.75, 0.05]} color="#f1f6fa" />
          </group>
        ))}
        {roof && (
          <group>
            <Block position={[0, 5.08, -6.95]} rotation={[-0.14, 0, 0]} size={[21.1, 0.18, 6.2]} color={accent} />
            <Block position={[0, 5.08, -0.98]} rotation={[0.14, 0, 0]} size={[21.1, 0.18, 6.2]} color={accent} />
            <Block position={[0, 5.51, -4]} size={[21.1, 0.14, 0.16]} color="#7c9fe9" />
            {[-6.5, -2.2, 2.2, 6.5].map((x) => (
              <group key={x}>
                <Block position={[x, 5.28, -6.3]} rotation={[-0.14, 0, 0]} size={[2.8, 0.1, 2.1]} color="#adc7e8" />
                <Block position={[x, 5.12, -1.1]} rotation={[0.14, 0, 0]} size={[2.8, 0.1, 2.1]} color="#94b5e1" />
                <Block position={[x, 5.33, -6.3]} rotation={[-0.14, 0, 0]} size={[0.07, 0.05, 2.1]} color="#e4ecf8" />
              </group>
            ))}
            <Label text="DX-OS LOGISTICS" position={[1, 5.9, -0.1]} width={6.5} color="#ffffff" />
          </group>
        )}
        <Block position={[-13.2, 1.5, -5.9]} size={[5.7, 3, 7.4]} color="#f5f8fc" />
        <Block position={[-13.2, 3.04, -5.9]} size={[6, 0.16, 7.7]} color="#c8d8eb" />
        {[-7.6, -5.8, -4].map((z) => (
          <Block key={z} position={[-16.08, 1.8, z]} size={[0.06, 1.3, 1.25]} color="#99bed6" />
        ))}
        <Block position={[-13.4, 1.85, -2.16]} size={[3.9, 1.6, 0.07]} color="#a6c5db" />
        <Block position={[-13.4, 1.85, -2.1]} size={[0.09, 1.6, 0.08]} color="#f9fbff" />
        <Block position={[-13.4, 0.12, -1.8]} size={[4.2, 0.24, 0.8]} color="#d7e0e8" />
      </group>
      {dockXs.map((x, index) => {
        const movement = associated[index];
        const busy = Boolean(movement);
        return (
          <group
            key={index}
            position={[x, 0, 1.65]}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(movement ? { kind: "movement", id: movement.id } : { kind: "store", id: node.id });
            }}
          >
            <Block position={[0, 1.65, 0]} size={[2.45, 3.2, 0.25]} color="#657b98" />
            <Block position={[0, 1.65, 0.16]} size={[2.1, 2.8, 0.08]} color={busy ? "#9dbbd9" : "#b9c9da"} />
            {[0.6, 1, 1.4, 1.8, 2.2, 2.6].map((y) => (
              <Block key={y} position={[0, y, 0.22]} size={[2.1, 0.035, 0.04]} color="#8fa5bb" />
            ))}
            <Block position={[0, 0.13, 0.8]} size={[2.5, 0.26, 1.4]} color="#b1becd" />
            {[-1.37, 1.37].map((offset) => (
              <group key={offset}>
                <Block position={[offset, 0.65, 0.45]} size={[0.11, 1.3, 0.11]} color="#efc568" />
                <Block position={[offset, 0.8, 0.45]} size={[0.12, 0.25, 0.12]} color="#555e68" />
              </group>
            ))}
            <Block position={[1.3, 2.75, 0.24]} size={[0.12, 0.25, 0.12]} color={busy ? "#55b39b" : "#c7d2df"} />
            {labels && <Label text={`CỬA ${String(index + 1).padStart(2, "0")}`} position={[0, 3.3, 0.4]} width={1.5} />}
            {movement && selection?.kind === "movement" && selection.id === movement.id && <SelectionRing radius={1.6} />}
          </group>
        );
      })}
      {shownStocks.map((stock, index) => {
        const selected = selection?.kind === "stock" && selection.id === stock.id;
        const color = stock.quality === "hold" ? "#e7a064" : stock.reserved > 0 ? "#cbb376" : "#d9b78b";
        return (
          <group
            key={stock.id}
            position={[-7.5 + (index % 5) * 3.5, 0, -6 + Math.floor(index / 5) * 2.4]}
            onClick={(event) => {
              event.stopPropagation();
              onSelect({ kind: "stock", id: stock.id });
            }}
          >
            {[0, 1.5].map((y) => (
              <group key={y} position={[0, y, 0]}>
                <Block position={[0, 0.08, 0]} size={[2.6, 0.12, 1.3]} color="#a1b2c9" />
                <Pallet position={[-0.6, 0.18, 0]} boxes={stock.on_hand > 0} color={color} />
                <Pallet position={[0.6, 0.18, 0]} boxes={stock.on_hand > 0} color={color} />
              </group>
            ))}
            {[-1.22, 1.22].map((x) => (
              <Block key={x} position={[x, 1.5, 0]} size={[0.08, 3, 1.3]} color={stock.quality === "hold" ? "#da965c" : "#dfad5c"} />
            ))}
            {stock.quality === "hold" && <Block position={[0, 0.03, 0]} size={[3, 0.02, 1.7]} color="#fff0df" />}
            {selected && <SelectionRing radius={1.65} />}
            {!roof && labels && (
              <Label text={stock.name} position={[0, 3.6, 0]} width={3.1} color={stock.quality === "hold" ? "#ac6a2d" : "#436088"} />
            )}
            {!roof && labels && selected && (
              <Label text={`${stock.on_hand} ${stock.unit} · Giữ ${stock.reserved}`} position={[0, 3.15, 0]} width={3.1} />
            )}
          </group>
        );
      })}
      {selection?.kind === "store" && selection.id === node.id && (
        <mesh position={[0, 0.04, -4]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[12.8, 12.94, 96]} />
          <meshBasicMaterial color="#3973ff" transparent opacity={0.6} />
        </mesh>
      )}
      <ScreenLabel
        title={storeName(node.id)}
        subtitle={`${node.stocks.length} dòng tồn · ${node.held} cách ly`}
        position={[-9.2, 6, -6.4]}
        visible={labels}
      />
    </group>
  );
}
