import { memo, useMemo } from 'react';
import { Trees } from "./Environment";
import { yardPosition } from "../sim/motion";
import { isDocked } from "../sim/engine";
import { ScreenLabel } from "./ScreenLabel";
import { useWarehouse } from "../data/store";
import { sites } from "../data/seed";
import { Block, Label, Pallet, SelectionRing } from "./Primitives";
export const WarehouseBuilding = memo(function WarehouseBuilding() {
  const siteId = useWarehouse((s) => s.siteId),
    roof = useWarehouse((s) => s.roof),
    labels = useWarehouse((s) => s.labels);
  const docks = useWarehouse((s) => s.docks),
    busyDockIds = useWarehouse(s => s.trucks.filter(isDocked).map(t=>t.dockId).join(','));
  const inventory = useMemo(()=>useWarehouse.getState().inventory.filter(i=>i.siteId===siteId),[siteId]);
  const selection = useWarehouse((s) => s.selection),
    select = useWarehouse((s) => s.select);
  const site = sites.find((s) => s.id === siteId)!;
  return (
    <group>
      <group
        onClick={(e) => {
          e.stopPropagation();
          select({ kind: "site", id: siteId });
        }}
      >
        <Block position={[0, 0.2, -4]} size={[21, 0.4, 12]} color="#e4e9ee" />
        <Block position={[0, 2.4, -9.7]} size={[20.4, 4.6, 0.3]} color="#e8eef5" />
        <Block position={[-10.1, 2.4, -4]} size={[0.3, 4.6, 11.5]} color="#f7f9fc" />
        <Block position={[10.1, 2.4, -4]} size={[0.3, 4.6, 11.5]} color="#dfe8f3" />
        <Block position={[0, 4.15, 1.7]} size={[20.4, 1.1, 0.3]} color="#eef2f8" />
        <Block position={[0,1.8,1.65]} size={[20.4,3.6,.2]} color="#edf2f9"/>
        <Block position={[0, 3.73, 1.91]} size={[20.6, 0.18, 0.2]} color={site.accent} />
        {Array.from({ length: 7 }, (_, i) => (
          <Block key={i} position={[-10 + i * 3.33, 1.9, 1.72]} size={[0.55, 3.7, 0.38]} color="#edf2f8" />
        ))}
        {[-8, -4, 0, 4, 8].map((x) => (
          <group key={x}>
            <Block position={[x, 3.4, -9.49]} size={[2.6, 0.75, 0.08]} color="#aed0e0" />
            <Block position={[x, 3.4, -9.43]} size={[0.05, 0.75, 0.05]} color="#f1f6fa" />
          </group>
        ))}
        {roof && site.kind !== "cold_store" && site.kind !== "automated_dc" && (
          <group>
            <Block position={[0, 5.08, -6.95]} rotation={[-0.14, 0, 0]} size={[21.1, 0.18, 6.2]} color={site.accent} />
            <Block position={[0, 5.08, -0.98]} rotation={[0.14, 0, 0]} size={[21.1, 0.18, 6.2]} color={site.accent} />
            <Block position={[0, 5.51, -4]} size={[21.1, 0.14, 0.16]} color="#7c9fe9" />
            {[-6.5, -2.2, 2.2, 6.5].map((x) => (
              <group key={x}>
                <Block position={[x, 5.28, -6.3]} rotation={[-0.14, 0, 0]} size={[2.8, 0.1, 2.1]} color="#adc7e8" />
                <Block position={[x, 5.12, -1.1]} rotation={[0.14, 0, 0]} size={[2.8, 0.1, 2.1]} color="#94b5e1" />
                <Block position={[x, 5.33, -6.3]} rotation={[-0.14, 0, 0]} size={[0.07, 0.05, 2.1]} color="#e4ecf8" />
              </group>
            ))}
            <Label text="KHOSPACE" position={[1, 5.9, -0.1]} width={5.5} color="#ffffff" />
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
      {roof && (site.kind === "cold_store" || site.kind === "automated_dc") && <Block position={[0,4.9,-4]} size={[21,.25,12]} color="#e9f1fb"/>}
      {docks
        .filter((d) => d.siteId === siteId)
        .map((d) => {
          const busy = busyDockIds.split(',').includes(d.id);
          return (
            <group
              key={d.id}
              position={d.position}
              onClick={(e) => {
                e.stopPropagation();
                select({ kind: "dock", id: d.id });
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "auto";
              }}
            >
              <Block position={[0, 1.65, 0]} size={[2.45, 3.2, 0.25]} color="#45618a" />
              <Block position={[0, 1.65, 0.16]} size={[2.1, 2.8, 0.08]} color={busy ? "#9dbbd9" : "#b9c9da"} />
              {[0.6, 1, 1.4, 1.8, 2.2, 2.6].map((y) => (
                <Block key={y} position={[0, y, 0.22]} size={[2.1, 0.035, 0.04]} color="#8fa5bb" />
              ))}
              <Block position={[0, 0.13, 0.8]} size={[2.5, 0.26, 1.4]} color="#b1becd" />
              {[-1.37, 1.37].map((x) => (
                <group key={x}>
                  <Block position={[x, 0.65, 0.45]} size={[0.11, 1.3, 0.11]} color="#efc568" />
                  <Block position={[x, 0.8, 0.45]} size={[0.12, 0.25, 0.12]} color="#555e68" />
                </group>
              ))}
              <Block position={[1.3, 2.75, 0.24]} size={[0.12, 0.25, 0.12]} color={busy ? "#55b39b" : "#e9b961"} />
              {labels && <Label text={d.name.toUpperCase()} position={[0, 3.3, 0.4]} width={1.5} />}
              {selection?.id === d.id && <SelectionRing radius={1.6} />}
            </group>
          );
        })}
      {inventory
        .filter((i) => i.siteId === siteId)
        .map((item, idx) => (
          <group
            key={item.id}
            position={item.position}
            onClick={(e) => {
              e.stopPropagation();
              select({ kind: "inventory", id: item.id });
            }}
          >
            {[0, 1.5].map((y) => (
              <group key={y} position={[0, y, 0]}>
                <Block position={[0, 0.08, 0]} size={[2.6, 0.12, 1.3]} color="#a1b2c9" />
                <Pallet position={[-0.6, 0.18, 0]} />
                <Pallet position={[0.6, 0.18, 0]} />
              </group>
            ))}
            {[-1.22, 1.22].map((x) => (
              <Block key={x} position={[x, 1.5, 0]} size={[0.08, 3, 1.3]} color="#dfad5c" />
            ))}
            {selection?.id === item.id && <SelectionRing radius={1.65} />}
            {!roof && labels && idx % 5 === 0 && <Label text={`KỆ ${item.location}`} position={[0, 3.5, 0]} width={2} />}
          </group>
        ))}
      <ScreenLabel position={[-12, 4.4, -4]} visible={labels} title={site.code} subtitle={site.name.toUpperCase()} />
    </group>
  );
});
export const SiteGround = memo(function SiteGround() {
  return (
    <group>

      <Block position={[0, -0.08, -6]} size={[94, 0.12, 78]} color="#f2f4fb" />
      <Block position={[0, 0.04, 13.9]} size={[94, 0.05, 5.6]} color="#d8dfef" />
      <Block position={[0, 0.08, 10.85]} size={[94, 0.13, 0.4]} color="#f9fbfd" />
      <Block position={[0, 0.08, 16.95]} size={[94, 0.13, 0.4]} color="#f9fbfd" />
      {Array.from({ length: 15 }, (_, i) => (
        <Block key={i} position={[-20 + i * 2.85, 0.076, 14]} size={[1.25, 0.015, 0.09]} color="#f9fbff" />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <Block key={i} position={[18, 0.08, 11.5 + i * 0.57]} size={[2.3, 0.015, 0.25]} color="#f6f9ff" />
      ))}
      {[-8.25, -4.95, -1.65, 1.65, 4.95, 8.25].map((x) => (
        <group key={x}>
          <Block position={[x - 1.42, 0.045, 5.65]} size={[0.055, 0.018, 6.5]} color="#d7bc79" />
          <Block position={[x, 0.045, 8.9]} size={[2.9, 0.018, 0.06]} color="#d7bc79" />
        </group>
      ))}
      {Array.from({length:24},(_,i)=>{const [x,,z]=yardPosition({id:'slot-p'+(i+1)});return <group key={'yard'+i} position={[x,.05,z]}>{[-1,1].map(side=><Block key={side} position={[side*.75,0,0]} size={[.035,.015,1.3]} color="#d7bc79"/>)}<Block position={[0,0,.65]} size={[1.5,.015,.035]} color="#d7bc79"/></group>;})}
      <Trees/>
      {Array.from({ length: 18 }, (_, i) => (
        <group key={i} position={[-20 + i * 2.4, 0, -15]}>
          <Block position={[0, 0.85, 0]} size={[0.06, 1.7, 0.06]} color="#a5b3c1" />
          <Block position={[1.2, 1.5, 0]} size={[2.4, 0.035, 0.035]} color="#b8c5d1" />
          <Block position={[1.2, 0.7, 0]} size={[2.4, 0.025, 0.025]} color="#b8c5d1" />
        </group>
      ))}
      {[-15, 16].map((x) => (
        <group key={x} position={[x, 0, 10]}>
          <Block position={[0, 2, 0]} size={[0.09, 4, 0.09]} color="#8394a6" />
          <Block position={[0.4, 4, 0]} size={[0.8, 0.08, 0.12]} color="#8394a6" />
        </group>
      ))}
      <Block position={[-14.6, 1, 3.8]} size={[4.5, 2, 2]} color="#609f98" />
      {Array.from({ length: 11 }, (_, i) => (
        <Block key={i} position={[-16.5 + i * 0.4, 1, 4.82]} size={[0.035, 1.85, 0.04]} color="#8bbdb7" />
      ))}
      <Block position={[-14.6, 2.04, 3.8]} size={[4.6, 0.08, 2.1]} color="#8fc0b9" />
    </group>
  );
});
