import { ChannelStore, DEFAULT_MOTION_STATE, StateStore } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import { BlinkPlugin } from "./blink-plugin.js";

function pluginInput(state: StateStore) {
  return { state, channels: new ChannelStore() };
}

describe("BlinkPlugin", () => {
  it("outputs reduced eyeYaw while blink is active", () => {
    const plugin = new BlinkPlugin({ closeDuration: 1, blinkStrength: 0.5 });
    const now = Date.now() / 1000;
    (plugin as unknown as { blinkUntil: number }).blinkUntil = now + 0.5;

    const output = plugin.process(pluginInput(new StateStore()), DEFAULT_MOTION_STATE);

    expect(output.eyeYaw).toBeDefined();
    expect(output.eyeYaw).toBeLessThan(1);
  });

  it("clamps blinkStrength to 1", () => {
    const plugin = new BlinkPlugin({ blinkStrength: 5 });
    expect((plugin as unknown as { blinkStrength: number }).blinkStrength).toBe(1);
  });
});
