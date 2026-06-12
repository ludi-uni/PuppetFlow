import { ChannelStore, DEFAULT_MOTION_STATE } from "@puppetflow/core";
import { StateStore } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import { EmotionPlugin } from "./emotion-plugin.js";

describe("EmotionPlugin", () => {
  it("reads joy from channel string emotion", () => {
    const channels = new ChannelStore();
    channels.set("emotion", "joy");

    const plugin = new EmotionPlugin({ joySmileGain: 0.8 });
    const output = plugin.process(
      { state: new StateStore(), channels },
      DEFAULT_MOTION_STATE,
    );

    expect(output.mouthX).toBe(0.8);
  });

  it("prefers numeric joy channel over string mapping", () => {
    const channels = new ChannelStore();
    channels.set("emotion", "sadness");
    channels.set("joy", 0.5);

    const plugin = new EmotionPlugin({ joySmileGain: 1 });
    const output = plugin.process(
      { state: new StateStore(), channels },
      DEFAULT_MOTION_STATE,
    );

    expect(output.mouthX).toBe(0.5);
  });
});
