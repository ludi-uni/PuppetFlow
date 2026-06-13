import {
  clamp01,
  type BehaviorPlugin,
  type MotionState,
  type PluginInputStores,
} from "@puppetflow/core";

export interface AttentionPluginConfig {
  leanGain?: number;
  tiltGain?: number;
}

export class AttentionPlugin implements BehaviorPlugin {
  readonly id = "attention";

  private readonly leanGain: number;
  private readonly tiltGain: number;

  constructor(config: AttentionPluginConfig = {}) {
    this.leanGain = config.leanGain ?? 0.2;
    this.tiltGain = config.tiltGain ?? 0.1;
  }

  process(input: PluginInputStores, _motion: MotionState): Partial<MotionState> {
    const interest = input.state.get("interest");
    if (typeof interest !== "number") {
      return {};
    }

    return {
      bodyLean: clamp01(0.5 + (interest - 0.5) * this.leanGain),
      headTilt: clamp01(0.5 + (interest - 0.5) * this.tiltGain),
    };
  }
}
