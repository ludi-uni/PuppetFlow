import {
  clamp01,
  type BehaviorPlugin,
  type MotionState,
  type PluginInputStores,
} from "@puppetflow/core";

export interface IdlePluginConfig {
  interestThreshold?: number;
  wanderBoost?: number;
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export class IdlePlugin implements BehaviorPlugin {
  readonly id = "idle";

  private readonly interestThreshold: number;
  private readonly wanderBoost: number;
  private idleTime = 0;
  private lastTime = nowMs();

  constructor(config: IdlePluginConfig = {}) {
    this.interestThreshold = config.interestThreshold ?? 0.35;
    this.wanderBoost = config.wanderBoost ?? 0.12;
  }

  process(input: PluginInputStores, _motion: MotionState): Partial<MotionState> {
    const state = input.state;
    const interest = state.get("interest");
    const interestValue = typeof interest === "number" ? interest : 0.5;

    if (interestValue >= this.interestThreshold) {
      this.idleTime = 0;
      return {};
    }

    const currentTime = nowMs();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;
    this.idleTime += deltaTime;

    const boost = Math.min(this.wanderBoost, this.idleTime * 0.01);
    const lookX = 0.5 + Math.sin(this.idleTime * 0.8) * boost;
    const lookY = 0.5 + Math.cos(this.idleTime * 0.5) * boost * 0.7;

    return {
      lookX: clamp01(lookX),
      lookY: clamp01(lookY),
    };
  }
}
