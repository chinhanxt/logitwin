// Detailed vehicle geometry from WareTrack. Motion and selection are owned by the API-backed scene.
import { Block, Label, Pallet, SelectionRing } from "./Primitives";
import type { Position } from "./Primitives";

function Wheel({ position }: { position: Position }) {
  return (
    <group name="wheel" position={position}>
      <group rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.34, 0.34, 0.2, 12]} />
          <meshStandardMaterial color="#344353" />
        </mesh>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.025, 10]} />
          <meshStandardMaterial color="#b9c7d8" metalness={0.3} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

export function TruckGeometry({ color, selected = false, label }: { color: string; selected?: boolean; label?: string }) {
  return (
    <group>
      <Block position={[0, 0.55, 0]} size={[1.6, 0.2, 4.4]} color="#596b81" />
      <Block position={[0, 1.65, -0.65]} size={[1.85, 2.02, 3.3]} color="#f7faff" />
      <Block position={[0, 1.1, -0.65]} size={[1.88, 0.5, 3.34]} color={color} />
      <Block position={[0, 2.69, -0.65]} size={[1.92, 0.08, 3.38]} color="#e5edf6" />
      <Block position={[0, 1.32, 1.67]} size={[1.8, 1.62, 1.26]} color={color} />
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
      {label && <Label text={label} position={[0, 2.98, -0.65]} width={2.1} color="#456891" />}
      {selected && <SelectionRing radius={2.7} />}
    </group>
  );
}

export function ForkliftGeometry({ selected = false, lift = 0 }: { selected?: boolean; lift?: number }) {
  const height = Number.isFinite(lift) ? Math.min(1.2, Math.max(0, lift)) : 0;
  return (
    <group>
      <Block position={[0, 0.52, 0]} size={[0.95, 0.55, 1.4]} color="#e7b751" />
      <Block position={[0, 0.77, -0.42]} size={[0.95, 0.3, 0.5]} color="#f0c568" />
      <Block position={[0, 1, 0]} size={[0.45, 0.25, 0.4]} color="#3f5263" />
      {[-0.4, 0.4].map((x) => (
        <group key={x}>
          <Block position={[x, 1.25, -0.38]} size={[0.055, 1.15, 0.055]} color="#48596a" />
          <Block position={[x, 1.25, 0.45]} size={[0.055, 1.15, 0.055]} color="#48596a" />
          <Block position={[x, 1.2, 0.8]} size={[0.09, 2, 0.09]} color="#536375" />
          {[-0.45, 0.47].map((z) => (
            <group key={z} name="wheel" position={[x * 1.2, 0.27, z]}>
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.24, 0.24, 0.18, 10]} />
                <meshStandardMaterial color="#344252" />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      <Block position={[0, 1.85, 0.02]} size={[1.05, 0.1, 1.12]} color="#e9bd5d" />
      <group name="fork-lift" position={[0, height, 0]}>
        {[-0.4, 0.4].map((x) => (
          <Block key={x} position={[x, 0.3, 1.25]} size={[0.09, 0.07, 0.95]} color="#718095" />
        ))}
        <Pallet position={[0, 0.32, 1.2]} />
      </group>
      {selected && <SelectionRing radius={1.45} />}
    </group>
  );
}
