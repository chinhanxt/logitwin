import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import type { Position } from "../data/model";
/** Noninteractive, projected DOM labels. No nested React roots or unmount races. */
export function ScreenLabel({
  title,
  subtitle,
  position,
  variant = "map",
  visible = true,
}: {
  title: string;
  subtitle: string;
  position: Position;
  variant?: "map" | "vehicle";
  visible?: boolean;
}) {
  const group = useRef<Group>(null),
    node = useRef<HTMLDivElement | null>(null),
    projected = useRef(new Vector3());
  const { gl } = useThree();
  useEffect(() => {
    const element = document.createElement("div");
    element.className = variant === "vehicle" ? "vehicle-label" : "map-label";
    element.style.position = "absolute";
    element.style.pointerEvents = "none";
    element.style.zIndex = "2";
    element.setAttribute("aria-hidden", "true");
    const heading = document.createElement("span");
    heading.className = "screen-label-title";
    heading.textContent = title;
    const sub = document.createElement("small");
    sub.textContent = subtitle;
    element.append(heading, sub);
    gl.domElement.parentElement?.appendChild(element);
    node.current = element;
    return () => {
      element.remove();
      node.current = null;
    };
  }, [gl, variant, title, subtitle]);
  useFrame(({ camera, size }) => {
    if (!node.current || !group.current) return;
    group.current.getWorldPosition(projected.current);
    projected.current.project(camera);
    node.current.style.display = visible && Math.abs(projected.current.z) <= 1 ? "block" : "none";
    node.current.style.left = `${((projected.current.x + 1) * size.width) / 2}px`;
    node.current.style.top = `${((1 - projected.current.y) * size.height) / 2}px`;
    node.current.style.transform = "translate(-50%,-50%)";
  });
  return <group ref={group} position={position} />;
}
