import {
  cloneMotionFrame,
  type MotionFrame,
} from "@puppetflow/core";
import type { MotionFrameEmitter, MotionSource } from "@puppetflow/source-core";
import { readMotionRecording } from "./motion-recording.js";

export interface ReplaySourceOptions {
  id?: string;
  speed?: number;
  loop?: boolean;
  startOffsetMs?: number;
}

export class ReplaySource implements MotionSource {
  readonly id: string;

  private readonly path: string;
  private readonly speed: number;
  private readonly loop: boolean;
  private readonly startOffsetMs: number;
  private controller: AbortController | null = null;
  private done: Promise<void> | null = null;
  private playbackError: unknown;

  constructor(path: string, options: ReplaySourceOptions = {}) {
    if (options.speed !== undefined && (!Number.isFinite(options.speed) || options.speed <= 0)) {
      throw new RangeError("speed must be a positive finite number");
    }
    if (
      options.startOffsetMs !== undefined &&
      (!Number.isFinite(options.startOffsetMs) || options.startOffsetMs < 0)
    ) {
      throw new RangeError("startOffsetMs must be a finite non-negative number");
    }

    this.path = path;
    this.id = options.id ?? "replay";
    this.speed = options.speed ?? 1;
    this.loop = options.loop ?? false;
    this.startOffsetMs = options.startOffsetMs ?? 0;
  }

  async start(emit: MotionFrameEmitter): Promise<void> {
    if (this.controller) {
      return;
    }

    const controller = new AbortController();
    this.controller = controller;
    this.playbackError = undefined;
    this.done = this.play(controller.signal, emit)
      .catch((error) => {
        if (!controller.signal.aborted) {
          this.playbackError = error;
        }
      })
      .finally(() => {
        if (this.controller === controller) {
          this.controller = null;
        }
      });
  }

  async stop(): Promise<void> {
    const controller = this.controller;
    if (controller) {
      controller.abort();
    }
    await this.done;
    this.done = null;
    this.controller = null;
  }

  async waitUntilFinished(): Promise<void> {
    await this.done;
    if (this.playbackError) {
      throw this.playbackError;
    }
  }

  private async play(signal: AbortSignal, emit: MotionFrameEmitter): Promise<void> {
    do {
      let previousTimestamp: number | undefined;
      let emitted = false;

      for await (const frame of readMotionRecording(this.path, { signal })) {
        if (signal.aborted) {
          return;
        }
        if (frame.timestamp < this.startOffsetMs) {
          continue;
        }

        const delayMs =
          previousTimestamp === undefined
            ? Math.max(0, frame.timestamp - this.startOffsetMs) / this.speed
            : Math.max(0, frame.timestamp - previousTimestamp) / this.speed;
        if (!(await waitForDelay(delayMs, signal))) {
          return;
        }

        emit(cloneMotionFrame(frame));
        previousTimestamp = frame.timestamp;
        emitted = true;
      }

      if (!this.loop || !emitted) {
        return;
      }
    } while (!signal.aborted);
  }
}

async function waitForDelay(delayMs: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve(true);
    }, delayMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
