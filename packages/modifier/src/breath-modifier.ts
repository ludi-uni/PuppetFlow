import { clamp01, type MotionState } from "@puppetflow/core";
import type { MotionModifier } from "@puppetflow/modifier-core";

export interface BreathModifierConfig {
  period?: number;
  amplitude?: number;
}

export class BreathModifier implements MotionModifier {
  readonly id = "breath";

  private readonly period: number;
  private readonly amplitude: number;
  private phase = 0;

  constructor(config: BreathModifierConfig = {}) {
    this.period = config.period ?? 4;
    this.amplitude = config.amplitude ?? 0.05;
  }

  apply(_current: MotionState, target: MotionState, deltaTime: number): MotionState {
    this.phase += deltaTime;
    const wave = Math.sin((this.phase / this.period) * Math.PI * 2) * this.amplitude;

    return {
      ...target,
      bodyLean: clamp01(target.bodyLean + wave),
    };
  }
}
