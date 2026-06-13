import { ChannelStore, DEFAULT_MOTION_STATE, StateStore } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import { AttentionPlugin } from "./attention-plugin.js";

function pluginInput(state: StateStore) {
  return { state, channels: new ChannelStore() };
}

describe("AttentionPlugin", () => {
  it("keeps headTilt and bodyLean at neutral when interest is 0.5", () => {
    const state = new StateStore();
    state.set("interest", 0.5);

    const plugin = new AttentionPlugin({ leanGain: 0.25, tiltGain: 0.2 });
    const output = plugin.process(pluginInput(state), DEFAULT_MOTION_STATE);

    expect(output.headTilt).toBe(0.5);
    expect(output.bodyLean).toBe(0.5);
  });

  it("tilts head and body when interest rises", () => {
    const state = new StateStore();
    state.set("interest", 1);

    const plugin = new AttentionPlugin({ leanGain: 0.25, tiltGain: 0.2 });
    const output = plugin.process(pluginInput(state), DEFAULT_MOTION_STATE);

    expect(output.headTilt).toBeGreaterThan(0.5);
    expect(output.bodyLean).toBeGreaterThan(0.5);
  });
});
