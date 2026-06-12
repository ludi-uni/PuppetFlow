import {
  clamp01,
  type BehaviorPlugin,
  type ChannelStore,
  type MotionState,
  type PluginInputStores,
} from "@puppetflow/core";

export interface EmotionPluginConfig {
  joySmileGain?: number;
  sadnessBrowGain?: number;
  angerBrowGain?: number;
}

function applyEmotionString(
  emotion: string,
  output: Partial<MotionState>,
  config: Required<EmotionPluginConfig>,
): void {
  switch (emotion.toLowerCase()) {
    case "joy":
    case "happy":
      output.mouthX = clamp01(config.joySmileGain);
      break;
    case "sadness":
    case "sad":
      output.facePitch = clamp01(0.5 - config.sadnessBrowGain * 0.2);
      break;
    case "anger":
    case "angry":
      output.facePitch = clamp01(0.5 - config.angerBrowGain * 0.2);
      break;
    case "curious":
      output.lookX = 0.6;
      break;
    default:
      break;
  }
}

function applyNumericEmotion(
  channels: ChannelStore,
  output: Partial<MotionState>,
  config: Required<EmotionPluginConfig>,
): void {
  const joy = channels.get("joy");
  if (typeof joy === "number") {
    output.mouthX = clamp01(joy * config.joySmileGain);
  }

  const sadness = channels.get("sadness");
  if (typeof sadness === "number") {
    output.facePitch = clamp01(0.5 - sadness * config.sadnessBrowGain * 0.2);
  }

  const anger = channels.get("anger");
  if (typeof anger === "number") {
    output.facePitch = clamp01(0.5 - anger * config.angerBrowGain * 0.2);
  }
}

export class EmotionPlugin implements BehaviorPlugin {
  readonly id = "emotion";

  private readonly config: Required<EmotionPluginConfig>;

  constructor(config: EmotionPluginConfig = {}) {
    this.config = {
      joySmileGain: config.joySmileGain ?? 0.7,
      sadnessBrowGain: config.sadnessBrowGain ?? 0.5,
      angerBrowGain: config.angerBrowGain ?? 0.6,
    };
  }

  process(input: PluginInputStores, _motion: MotionState): Partial<MotionState> {
    const output: Partial<MotionState> = {};
    const { channels } = input;

    applyNumericEmotion(channels, output, this.config);

    const emotion = channels.get("emotion");
    if (typeof emotion === "string") {
      applyEmotionString(emotion, output, this.config);
    }

    return output;
  }
}
