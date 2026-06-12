import {
  clamp01,
  type BehaviorPlugin,
  type MotionState,
  type PluginInputStores,
} from "@puppetflow/core";

export interface GazePluginConfig {
  wanderAmplitude?: number;
  speed?: number;
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export class GazePlugin implements BehaviorPlugin {
  readonly id = "gaze";

  private readonly wanderAmplitude: number;
  private readonly speed: number;
  private phase = 0;
  private lastTime = nowMs();

  constructor(config: GazePluginConfig = {}) {
    this.wanderAmplitude = config.wanderAmplitude ?? 0.05;
    this.speed = config.speed ?? 0.35;
  }

  process(_input: PluginInputStores, _motion: MotionState): Partial<MotionState> {
    const currentTime = nowMs();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.phase += this.speed * deltaTime;
    const lookX = 0.5 + Math.sin(this.phase) * this.wanderAmplitude;
    const lookY = 0.5 + Math.cos(this.phase * 0.7) * this.wanderAmplitude * 0.6;

    return {
      lookX: clamp01(lookX),
      lookY: clamp01(lookY),
    };
  }
}
