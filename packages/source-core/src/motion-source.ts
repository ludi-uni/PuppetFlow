import type { MotionFrame } from "@puppetflow/core";

export type MotionFrameEmitter = (frame: MotionFrame) => void;

export interface MotionSource {
  readonly id: string;
  start(emit: MotionFrameEmitter): Promise<void>;
  stop(): Promise<void>;
}
