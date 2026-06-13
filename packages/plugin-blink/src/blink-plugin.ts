import {
  clamp01,
  type BehaviorPlugin,
  type MotionState,
  type PluginInputStores,
} from "@puppetflow/core";

export interface BlinkPluginConfig {
  minInterval?: number;
  maxInterval?: number;
  closeDuration?: number;
  /** eyeYaw（まぶた開き 0–1）の閉眼量 */
  blinkStrength?: number;
}

export class BlinkPlugin implements BehaviorPlugin {
  readonly id = "blink";

  private readonly minInterval: number;
  private readonly maxInterval: number;
  private readonly closeDuration: number;
  private readonly blinkStrength: number;
  private nextBlinkAt: number | null = null;
  private blinkUntil = 0;

  constructor(config: BlinkPluginConfig = {}) {
    this.minInterval = config.minInterval ?? 3;
    this.maxInterval = config.maxInterval ?? 8;
    this.closeDuration = config.closeDuration ?? 0.12;
    this.blinkStrength = clamp01(config.blinkStrength ?? 0.15);
  }

  process(_input: PluginInputStores, _motion: MotionState): Partial<MotionState> {
    const now = Date.now() / 1000;

    if (this.nextBlinkAt === null) {
      this.nextBlinkAt =
        now + this.minInterval + Math.random() * (this.maxInterval - this.minInterval);
    }

    if (now >= this.nextBlinkAt && this.blinkUntil === 0) {
      this.blinkUntil = now + this.closeDuration;
      const interval =
        this.minInterval + Math.random() * (this.maxInterval - this.minInterval);
      this.nextBlinkAt = now + interval;
    }

    if (this.blinkUntil > now) {
      const progress = 1 - (this.blinkUntil - now) / this.closeDuration;
      const closeAmount = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
      return { eyeYaw: clamp01(1 - closeAmount * this.blinkStrength) };
    }

    this.blinkUntil = 0;
    return {};
  }
}
