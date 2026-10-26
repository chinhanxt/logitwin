import { ScreenLabel } from "./ScreenLabel";
import { useVehicleMotion } from "./useVehicleMotion";
import { Corners, PalletModel, useEntityEvents } from "./Entities";
import { forkliftLabel, statusLabel } from "../data/model";
import { useWarehouse } from "../data/store";
import type { Truck, Forklift } from "../data/model";
import { Block, Label, SelectionRing } from "./Primitives";
function Wheel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}><group name="wheel">
      <mesh castShadow>
        <cylinderGeometry args={[0.34, 0.34, 0.2, 12]} />
        <meshStandardMaterial color="#344353" />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.025, 10]} />
        <meshStandardMaterial color="#b9c7d8" metalness={0.3} roughness={0.4} />
      </mesh>
    </group></group>
  );
}
export function TruckModel({ truck }: { truck: Truck }) {
  const {ref,initial}=useVehicleMotion(truck,.34);
  const selected = useWarehouse((s) => s.selection?.id === truck.id);
  const visible = !["in_transit","delivered"].includes(truck.status);
  const events = useEntityEvents({ kind: "truck", id: truck.id });
  const hovered = useWarehouse(s => s.hovered?.id === truck.id);
  if (!visible) return null;
  return (
    <group
      ref={ref}
      name={truck.id}
      position={initial.position}
      rotation={initial.rotation}
      {...events}
    >
      <Block position={[0, 0.55, 0]} size={[1.6, 0.2, 4.4]} color="#596b81" />
      <Block position={[0, 1.65, -0.65]} size={[1.85, 2.02, 3.3]} color="#f7faff" />
      <Block position={[0, 1.1, -0.65]} size={[1.88, 0.5, 3.34]} color={truck.color} />
      <Block position={[0, 2.69, -0.65]} size={[1.92, 0.08, 3.38]} color="#e5edf6" />
      <Block position={[0, 1.32, 1.67]} size={[1.8, 1.62, 1.26]} color={truck.color} />
      <Block position={[0, 1.75, 2.315]} size={[1.48, 0.64, 0.04]} color="#9dc4d8" />
      <Block position={[0, 0.85, 2.34]} size={[0.85, 0.23, 0.05]} color="#344f6b" />
      <Block position={[0, 0.58, 2.35]} size={[1.9, 0.15, 0.15]} color="#dce6f0" />
      {[-0.69, 0.69].map((x) => (
        <Block key={x} position={[x, 0.95, 2.34]} size={[0.26, 0.18, 0.06]} color="#fff4cf" />
      ))}
      {[-0.94, 0.94].map((x) => (
        <group key={x}>
          <Block position={[x, 1.77, 1.65]} size={[0.04, 0.59, 0.72]} color="#9dc4d8" />
          <Block position={[x * 1.1, 1.56, 2.03]} size={[0.15, 0.22, 0.22]} color="#536f8e" />
          {[-1.7, -0.95, 1.55].map((z) => (
            <Wheel key={z} position={[x, 0.4, z]} />
          ))}
        </group>
      ))}
      <Label text={truck.carrier.toUpperCase()} position={[0, 2.98, -0.65]} width={1.9} color="#456891" />
      {(selected || hovered) && <><SelectionRing radius={2.7}/><Corners/></>}
      <ScreenLabel
        position={[0, 3.6, 0]}
        variant="vehicle"
        visible={(selected || hovered) && visible}
        title={truck.name}
        subtitle={statusLabel[truck.status]}
      />
    </group>
  );
}
export function ForkliftModel({ forklift }: { forklift: Forklift }) {
  const {ref,initial}=useVehicleMotion(forklift,.24);
  const carrying=useWarehouse(s=>s.pallets.find(p=>p.id===forklift.carrying));
  const selected = useWarehouse((s) => s.selection?.id === forklift.id);
  const events = useEntityEvents({ kind: "forklift", id: forklift.id });
  const hovered = useWarehouse(s => s.hovered?.id === forklift.id);
  return (
    <group
      ref={ref}
      name={forklift.id}
      position={initial.position}
      rotation={initial.rotation}
      {...events}
    >
      <Block position={[0, 0.52, 0]} size={[0.95, 0.55, 1.4]} color="#e7b751" />
      <Block position={[0, 0.77, -0.42]} size={[0.95, 0.3, 0.5]} color="#f0c568" />
      <Block position={[0, 1, 0]} size={[0.45, 0.25, 0.4]} color="#3f5263" />
      {[-0.4, 0.4].map((x) => (
        <group key={x}>
          <Block position={[x, 1.25, -0.38]} size={[0.055, 1.15, 0.055]} color="#48596a" />
          <Block position={[x, 1.25, 0.45]} size={[0.055, 1.15, 0.055]} color="#48596a" />
          <Block position={[x, 1.2, 0.8]} size={[0.09, 2, 0.09]} color="#536375" />
          <Block position={[x, 0.3, 1.25]} size={[0.09, 0.07, 0.95]} color="#718095" />
          {[-0.45, 0.47].map((z) => (
            <group key={z} position={[x * 1.2, 0.27, z]} rotation={[0, 0, Math.PI / 2]}><mesh name="wheel" castShadow>
              <cylinderGeometry args={[0.24, 0.24, 0.18, 10]} />
              <meshStandardMaterial color="#344252" />
            </mesh></group>
          ))}
        </group>
      ))}
      <Block position={[0, 1.85, 0.02]} size={[1.05, 0.1, 1.12]} color="#e9bd5d" />
      {carrying && <PalletModel pallet={carrying} carried/>}
      <ScreenLabel title={forklift.name} subtitle={forkliftLabel[forklift.status]} position={[0,2.8,0]} visible={selected || hovered} variant="vehicle"/>
      {(selected || hovered) && <><SelectionRing radius={1.45}/><Corners width={1.5} depth={2}/></>}
    </group>
  );
}
