import { ChannelStore, DEFAULT_MOTION_STATE, StateStore } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import { IdlePlugin } from "./idle-plugin.js";

function pluginInput(state: StateStore) {
  return { state, channels: new ChannelStore() };
}

describe("IdlePlugin", () => {
  it("outputs look drift when interest is below threshold", () => {
    const state = new StateStore();
    state.set("interest", 0.1);

    const plugin = new IdlePlugin({ interestThreshold: 0.35, wanderBoost: 0.12 });
    const output = plugin.process(pluginInput(state), DEFAULT_MOTION_STATE);

    expect(output.lookX).toBeDefined();
    expect(output.lookY).toBeDefined();
  });

  it("returns empty output when interest is high", () => {
    const state = new StateStore();
    state.set("interest", 0.8);

    const plugin = new IdlePlugin();
    const output = plugin.process(pluginInput(state), DEFAULT_MOTION_STATE);

    expect(output).toEqual({});
  });
});
