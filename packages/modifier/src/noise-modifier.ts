import { clamp01, type MotionState, type MotionStateKey } from "@puppetflow/core";
import type { MotionModifier } from "@puppetflow/modifier-core";

export interface NoiseModifierConfig {
  amplitude?: number;
  keys?: MotionStateKey[];
}

const DEFAULT_NOISE_KEYS: MotionStateKey[] = ["facePitch", "mouthX"];
const DEFAULT_ACCELERATION = 0.35;
const DEFAULT_DAMPING = 3.5;
const MAX_DELTA_TIME = 0.1;

export class NoiseModifier implements MotionModifier {
  readonly id = "noise";

  private readonly amplitude: number;
  private readonly keys: MotionStateKey[];
  private readonly offsets = new Map<MotionStateKey, number>();
  private readonly velocities = new Map<MotionStateKey, number>();

  constructor(config: NoiseModifierConfig = {}) {
    this.amplitude = config.amplitude ?? 0.02;
    this.keys = config.keys ?? DEFAULT_NOISE_KEYS;
  }

  apply(_current: MotionState, target: MotionState, deltaTime: number): MotionState {
    const dt = Math.min(Math.max(deltaTime, 0), MAX_DELTA_TIME);
    const result = { ...target };

    for (const key of this.keys) {
      let velocity = this.velocities.get(key) ?? 0;
      let offset = this.offsets.get(key) ?? 0;

      velocity += (Math.random() - 0.5) * DEFAULT_ACCELERATION * dt;
      velocity *= Math.exp(-DEFAULT_DAMPING * dt);
      offset += velocity * dt;

      if (offset > this.amplitude) {
        offset = this.amplitude;
        velocity *= -0.3;
      } else if (offset < -this.amplitude) {
        offset = -this.amplitude;
        velocity *= -0.3;
      }

      this.offsets.set(key, offset);
      this.velocities.set(key, velocity);
      result[key] = clamp01(target[key] + offset);
    }

    return result;
  }
}
