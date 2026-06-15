import { ChannelStore, DEFAULT_MOTION_STATE, StateStore } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import { EmotionPlugin } from "./emotion-plugin.js";

function pluginInput(state: StateStore, channels = new ChannelStore()) {
  return { state, channels };
}

describe("EmotionPlugin", () => {
  it("maps joy channel to mouthX", () => {
    const channels = new ChannelStore();
    channels.set("joy", 0.8);

    const plugin = new EmotionPlugin({ joySmileGain: 0.7 });
    const output = plugin.process(
      pluginInput(new StateStore(), channels),
      DEFAULT_MOTION_STATE,
    );

    expect(output.mouthX).toBeCloseTo(0.56, 2);
  });

  it("maps curious emotion string to lookX", () => {
    const channels = new ChannelStore();
    channels.set("emotion", "curious");

    const plugin = new EmotionPlugin();
    const output = plugin.process(
      pluginInput(new StateStore(), channels),
      DEFAULT_MOTION_STATE,
    );

    expect(output.lookX).toBe(0.6);
  });
});
