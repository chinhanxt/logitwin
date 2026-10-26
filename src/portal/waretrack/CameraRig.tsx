import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { MOUSE, OrthographicCamera, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CameraCommand } from "../twin/camera";

interface Goal {
  position: Vector3;
  target: Vector3;
  zoom: number;
}
const initial = new Vector3(32, 29, 37);
const lowerBound = new Vector3(-22, 0, -16);
const upperBound = new Vector3(22, 0, 19);

/** WareTrack's orthographic camera, with resize fitting and demand-mode transitions. */
export function CameraRig({ command, reducedMotion, storeId }: { command: CameraCommand; reducedMotion: boolean; storeId: string }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const goal = useRef<Goal | null>(null);
  const consumedCommand = useRef<number | null>(null);
  const { camera, scene, size, invalidate } = useThree();
  const fit = Math.max(1, Math.min(size.width / 56, size.height / 35));
  useEffect(() => {
    (camera as OrthographicCamera).zoom = fit;
    if (goal.current) goal.current.zoom = fit;
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, fit, invalidate]);
  useEffect(() => {
    const cam = camera as OrthographicCamera;
    const control = controls.current;
    if (!control || consumedCommand.current === command.nonce) return;
    consumedCommand.current = command.nonce;
    if (command.kind === "in" || command.kind === "out") {
      const target = control.target.clone().clamp(lowerBound, upperBound);
      goal.current = {
        position: cam.position.clone().sub(control.target).add(target),
        target,
        zoom: Math.max(1, Math.min(80, cam.zoom * (command.kind === "in" ? 1.2 : 1 / 1.2))),
      };
    } else if (command.kind === "focus" && command.target) {
      const target = new Vector3(...command.target);
      if (command.objectName) scene.getObjectByName(command.objectName)?.getWorldPosition(target);
      target.clamp(lowerBound, upperBound);
      goal.current = { position: target.clone().add(initial), target, zoom: Math.min(80, fit * 2) };
    } else {
      goal.current = { position: command.kind === "top" ? new Vector3(0, 48, 2.1) : initial.clone(), target: new Vector3(0, 0, 1), zoom: fit };
    }
    invalidate();
  }, [command, camera, scene, fit, storeId, invalidate]);
  useFrame((_, delta) => {
    const control = controls.current;
    const destination = goal.current;
    if (!control || !destination) return;
    const cam = camera as OrthographicCamera;
    const alpha = reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * 7);
    cam.position.lerp(destination.position, alpha);
    control.target.lerp(destination.target, alpha);
    cam.zoom += (destination.zoom - cam.zoom) * alpha;
    if (
      cam.position.distanceTo(destination.position) < 0.015 &&
      Math.abs(cam.zoom - destination.zoom) < 0.015 &&
      control.target.distanceTo(destination.target) < 0.015
    ) {
      cam.position.copy(destination.position);
      control.target.copy(destination.target);
      cam.zoom = destination.zoom;
      goal.current = null;
    } else invalidate();
    control.target.clamp(lowerBound, upperBound);
    cam.updateProjectionMatrix();
    control.update();
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={[0, 0, 1]}
      minZoom={1}
      maxZoom={80}
      minPolarAngle={0.02}
      maxPolarAngle={Math.PI / 2.25}
      enableDamping
      dampingFactor={0.09}
      mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
      onStart={() => {
        goal.current = null;
      }}
    />
  );
}
