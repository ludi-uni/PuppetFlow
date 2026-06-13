import {
  clamp01,
  type BehaviorPlugin,
  type MotionState,
  type PluginInputStores,
} from "@puppetflow/core";

export interface GazePluginConfig {
  wanderAmplitude?: number;
  /** Phase advance in radians per second */
  speed?: number;
}

const MIN_SPEED = 0.05;
const MAX_SPEED = 0.5;
const MIN_WANDER = 0;
const MAX_WANDER = 0.2;

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
    this.wanderAmplitude = clamp01(
      Math.min(MAX_WANDER, Math.max(MIN_WANDER, config.wanderAmplitude ?? 0.05)),
    );
    this.speed = Math.min(
      MAX_SPEED,
      Math.max(MIN_SPEED, config.speed ?? 0.12),
    );
  }

  process(_input: PluginInputStores, _motion: MotionState): Partial<MotionState> {
    const currentTime = nowMs();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.phase += this.speed * deltaTime;
    const lookX = 0.5 + Math.sin(this.phase) * this.wanderAmplitude;
    const lookY =
      0.5 + Math.sin(this.phase + Math.PI * 0.35) * this.wanderAmplitude * 0.85;

    return {
      lookX: clamp01(lookX),
      lookY: clamp01(lookY),
    };
  }
}
