import {
  MOTION_STATE_KEYS,
  type MotionFrame,
  type MotionState,
} from "@puppetflow/core";
import type { MotionFrameEmitter, MotionSource } from "./motion-source.js";

export interface MotionStateFrameSourceOptions {
  id?: string;
  intervalMs?: number;
  now?: () => number;
}

export class MotionStateFrameSource implements MotionSource {
  readonly id: string;

  private readonly readState: () => MotionState;
  private readonly intervalMs: number;
  private readonly now: () => number;
  private timer: ReturnType<typeof setInterval> | undefined;
  private emitter: MotionFrameEmitter | undefined;
  private startedAt = 0;

  constructor(
    readState: () => MotionState,
    options: MotionStateFrameSourceOptions = {},
  ) {
    if (
      options.intervalMs !== undefined &&
      (!Number.isFinite(options.intervalMs) || options.intervalMs <= 0)
    ) {
      throw new RangeError("intervalMs must be a positive finite number");
    }

    this.id = options.id ?? "motion-state";
    this.readState = readState;
    this.intervalMs = options.intervalMs ?? 1000 / 60;
    this.now = options.now ?? Date.now;
  }

  async start(emit: MotionFrameEmitter): Promise<void> {
    if (this.timer !== undefined) {
      return;
    }

    this.emitter = emit;
    this.startedAt = this.now();
    this.emitFrame();
    this.timer = setInterval(() => this.emitFrame(), this.intervalMs);
  }

  async stop(): Promise<void> {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.emitter = undefined;
  }

  private emitFrame(): void {
    const emitter = this.emitter;
    if (!emitter) {
      return;
    }

    const state = this.readState();
    const parameters: Record<string, number> = {};
    for (const key of MOTION_STATE_KEYS) {
      parameters[key] = state[key];
    }
    Object.assign(parameters, state.custom);

    const frame: MotionFrame = {
      timestamp: Math.max(0, this.now() - this.startedAt),
      parameters,
      metadata: {
        sourceId: this.id,
        sourceType: "motion-state",
        clock: "relative",
      },
    };
    emitter(frame);
  }
}
