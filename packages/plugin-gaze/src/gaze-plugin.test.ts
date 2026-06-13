import { ChannelStore, DEFAULT_MOTION_STATE, StateStore } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import { GazePlugin } from "./gaze-plugin.js";

function pluginInput(state: StateStore) {
  return { state, channels: new ChannelStore() };
}

describe("GazePlugin", () => {
  it("outputs lookX and lookY around neutral", () => {
    const plugin = new GazePlugin({ wanderAmplitude: 0.04, speed: 0.12 });
    plugin.process(pluginInput(new StateStore()), DEFAULT_MOTION_STATE);
    const output = plugin.process(pluginInput(new StateStore()), DEFAULT_MOTION_STATE);

    expect(output.lookX).toBeDefined();
    expect(output.lookY).toBeDefined();
    expect(output.lookX).not.toBe(0.5);
    expect(output.lookY).not.toBe(0.5);
  });

  it("clamps speed to configured maximum", () => {
    const plugin = new GazePlugin({ speed: 99 });
    expect((plugin as unknown as { speed: number }).speed).toBe(0.5);
  });
});
