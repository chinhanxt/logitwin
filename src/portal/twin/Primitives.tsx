import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { Point } from "./model";

export function Box({
  at = [0, 0, 0],
  size,
  color = "#ffffff",
  onClick,
  opacity = 1,
}: {
  at?: Point;
  size: Point;
  color?: string;
  opacity?: number;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}) {
  return (
    <mesh position={at} castShadow receiveShadow onClick={onClick}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.8} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}
export function Label({
  text,
  at,
  width = 4,
  color = "#385675",
  background = "#ffffff",
  sub = "",
}: {
  text: string;
  at: Point;
  width?: number;
  color?: string;
  background?: string;
  sub?: string;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = sub ? 192 : 144;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = background;
    context.beginPath();
    context.roundRect(4, 4, 760, canvas.height - 8, 26);
    context.fill();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = color;
    context.font = "600 64px sans-serif";
    context.fillText(text, 384, sub ? 70 : 72, 706);
    if (sub) {
      context.fillStyle = "#8299b2";
      context.font = "38px sans-serif";
      context.fillText(sub, 384, 132, 706);
    }
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    return result;
  }, [text, sub, color, background]);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return (
    <sprite position={at} scale={[width, width * (sub ? 0.25 : 0.1875), 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} toneMapped={false} />
    </sprite>
  );
}
export function Tree({ at }: { at: Point }) {
  return (
    <group position={at}>
      <mesh position={[0, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.17, 1.3, 7]} />
        <meshStandardMaterial color="#ada087" />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow>
        <icosahedronGeometry args={[0.85, 1]} />
        <meshStandardMaterial color="#b4ccbb" roughness={1} />
      </mesh>
      <mesh position={[0.3, 2.15, 0]} castShadow>
        <icosahedronGeometry args={[0.62, 1]} />
        <meshStandardMaterial color="#cadacb" roughness={1} />
      </mesh>
    </group>
  );
}
export function Truck({
  at,
  color = "#3c86dc",
  scale = 1,
  onClick,
}: {
  at: Point;
  color?: string;
  scale?: number;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}) {
  return (
    <group position={at} scale={scale} onClick={onClick}>
      <Box at={[0, 0.65, 0]} size={[1.12, 1.05, 2.2]} color="#f4f8fc" />
      <Box at={[0, 0.08, 0.2]} size={[1.2, 0.16, 3.1]} color="#75899e" />
      <Box at={[0, 0.45, 1.4]} size={[1.13, 0.9, 1.1]} color={color} />
      <Box at={[0, 0.9, 1.35]} size={[1, 0.13, 1.03]} color={color} />
      <Box at={[0, 0.62, 1.96]} size={[0.86, 0.4, 0.025]} color="#c8e2ed" />
      <Box at={[0, 0.45, 1.98]} size={[0.55, 0.07, 0.035]} color="#f7f9fc" />
      {[-0.42, 0.42].map((x) => (
        <Box key={x} at={[x, 0.28, 1.99]} size={[0.17, 0.12, 0.035]} color="#fff4c8" />
      ))}
      {[-0.62, 0.62].flatMap((x) =>
        [-0.7, 1.25].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.08, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.25, 0.25, 0.16, 12]} />
            <meshStandardMaterial color="#526278" />
          </mesh>
        )),
      )}
      <Box at={[0, 1.25, -0.65]} size={[0.4, 0.2, 0.5]} color="#e3eaf2" />
    </group>
  );
}
