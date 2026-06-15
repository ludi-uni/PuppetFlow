import {
  clamp01,
  type BehaviorPlugin,
  type BehaviorPluginContext,
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
const LOOK_Y_PHASE_OFFSET = Math.PI * 0.35;

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
    this.speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, config.speed ?? 0.12));
  }

  process(
    _input: PluginInputStores,
    _motion: MotionState,
    context?: BehaviorPluginContext,
  ): Partial<MotionState> {
    const frequency = this.speed / (Math.PI * 2);
    const lookXOsc = context?.runStatefulNumber?.("oscillator", "gaze:lookX", {
      frequency,
    });
    const lookYOsc = context?.runStatefulNumber?.("oscillator", "gaze:lookY", {
      frequency,
      phaseOffset: LOOK_Y_PHASE_OFFSET,
    });

    if (lookXOsc !== undefined && lookYOsc !== undefined) {
      return {
        lookX: clamp01(0.5 + lookXOsc * this.wanderAmplitude),
        lookY: clamp01(0.5 + lookYOsc * this.wanderAmplitude * 0.85),
      };
    }

    const currentTime = nowMs();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.phase += this.speed * deltaTime;
    const lookX = 0.5 + Math.sin(this.phase) * this.wanderAmplitude;
    const lookY =
      0.5 + Math.sin(this.phase + LOOK_Y_PHASE_OFFSET) * this.wanderAmplitude * 0.85;

    return {
      lookX: clamp01(lookX),
      lookY: clamp01(lookY),
    };
  }
}
