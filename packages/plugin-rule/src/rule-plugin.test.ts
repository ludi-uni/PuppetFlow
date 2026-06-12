import { ChannelStore, DEFAULT_MOTION_STATE, StateStore } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import { RulePlugin } from "./rule-plugin.js";

function pluginInput(state: StateStore) {
  return { state, channels: new ChannelStore() };
}

describe("RulePlugin", () => {
  it("maps state input to motion output with gain", () => {
    const state = new StateStore();
    state.set("interest", 0.8);

    const plugin = new RulePlugin([{ input: "interest", output: "mouthX", gain: 0.5 }]);
    const output = plugin.process(pluginInput(state), DEFAULT_MOTION_STATE);

    expect(output.mouthX).toBe(0.4);
  });

  it("averages multiple rules targeting the same output", () => {
    const state = new StateStore();
    state.set("interest", 0.8);
    state.set("energy", 0.6);

    const plugin = new RulePlugin([
      { input: "interest", output: "mouthX", gain: 0.5 },
      { input: "energy", output: "mouthX", gain: 0.8 },
    ]);
    const output = plugin.process(pluginInput(state), DEFAULT_MOTION_STATE);

    expect(output.mouthX).toBeCloseTo(0.44, 5);
  });
});
