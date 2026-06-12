import { clamp01, MOTION_STATE_KEYS, type MotionState } from "@puppetflow/core";
import type { MotionModifier } from "@puppetflow/modifier-core";

export interface SmoothingModifierConfig {
  factor?: number;
}

const REFERENCE_FPS = 60;
const MAX_DELTA_TIME = 0.1;

export class SmoothingModifier implements MotionModifier {
  readonly id = "smoothing";

  private readonly factor: number;
  private readonly responseRate: number;

  constructor(config: SmoothingModifierConfig = {}) {
    this.factor = config.factor ?? 0.1;
    this.responseRate = -Math.log(1 - this.factor) * REFERENCE_FPS;
  }

  apply(current: MotionState, target: MotionState, deltaTime: number): MotionState {
    const dt = Math.min(Math.max(deltaTime, 0), MAX_DELTA_TIME);
    const alpha = 1 - Math.exp(-this.responseRate * dt);
    const result = { ...current };

    for (const key of MOTION_STATE_KEYS) {
      result[key] = clamp01(current[key] + (target[key] - current[key]) * alpha);
    }

    return result;
  }
}
