import type { Point } from "./model";

export type TwinView = "warehouse" | "network";
export type CameraCommand = { kind: "reset" | "top" | "in" | "out" | "focus"; target?: Point; objectName?: string; nonce: number };
