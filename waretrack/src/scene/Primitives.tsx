import type { ReactNode } from "react";
import { createInstances } from "@react-three/drei";
import { createContext, useContext, useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { Position } from "../data/model";
const BatchedContext = createContext(false);
const [BoxInstances, BoxInstance] = createInstances();
export function BlockInstances({ children }: { children: ReactNode }) {
 return <BatchedContext.Provider value={true}><BoxInstances limit={2000} castShadow receiveShadow><boxGeometry args={[1,1,1]}/><meshStandardMaterial roughness={.85}/>{children}</BoxInstances></BatchedContext.Provider>;
}
export function Block({
  position = [0, 0, 0],
  size = [1, 1, 1],
  color = "#fff",
  rotation = [0, 0, 0],
  ...props
}: {
  position?: Position;
  size?: Position;
  color?: string;
  rotation?: Position;
  transparent?: boolean;
  opacity?: number;
}) {
  const batched = useContext(BatchedContext);
  if (batched && !props.transparent) return <BoxInstance position={position} rotation={rotation} scale={size} color={color}/>;
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.72} {...props} />
    </mesh>
  );
}
export function Label({
  text,
  position,
  color = "#436088",
  width = 2.4,
}: {
  text: string;
  position: Position;
  color?: string;
  width?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.font = "600 48px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 48);
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[width, width * 0.1875, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}
export function Pallet({ position, boxes = true }: { position: Position; boxes?: boolean }) {
  return (
    <group position={position}>
      <Block position={[0, 0.12, 0]} size={[1.1, 0.16, 0.9]} color="#bb9871" />
      {[-0.39, 0, 0.39].map((x) => (
        <Block key={x} position={[x, 0.05, 0]} size={[0.13, 0.12, 0.85]} color="#a28362" />
      ))}
      {boxes && (
        <>
          <Block position={[-0.25, 0.48, 0]} size={[0.47, 0.6, 0.74]} color="#d9b78b" />
          <Block position={[0.25, 0.48, 0]} size={[0.47, 0.6, 0.74]} color="#e4c79e" />
          <Block position={[0, 0.82, 0]} size={[0.86, 0.08, 0.12]} color="#f3dfbd" />
        </>
      )}
    </group>
  );
}
export function Tree({ position, scale = 1 }: { position: Position; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <Block position={[0, 0.1, 0]} size={[1.1, 0.2, 1.1]} color="#d6ded8" />
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.13, 1.5, 6]} />
        <meshStandardMaterial color="#b8a28a" />
      </mesh>
      <mesh position={[0, 1.95, 0]} scale={[0.85, 1.3, 0.85]} castShadow>
        <icosahedronGeometry args={[0.85, 1]} />
        <meshStandardMaterial color="#82b9a1" flatShading />
      </mesh>
      <mesh position={[-0.24, 2.3, 0.15]} scale={[0.65, 0.9, 0.65]} castShadow>
        <icosahedronGeometry args={[0.65, 1]} />
        <meshStandardMaterial color="#a9d1af" flatShading />
      </mesh>
    </group>
  );
}
export function SelectionRing({ radius = 1.6 }: { radius?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
      <ringGeometry args={[radius, radius + 0.075, 64]} />
      <meshBasicMaterial color="#3973ff" transparent opacity={0.9} />
    </mesh>
  );
}
