import { ChannelStore, DEFAULT_MOTION_STATE, StateStore } from "@puppetflow/core";
import { executeBehavior } from "@puppetflow/behavior";
import { describe, expect, it } from "vitest";
import { compilePfScript } from "./compile.js";
import { SPEC_SAMPLE_PFSCRIPT } from "./samples.js";

describe("compilePfScript", () => {
  it("executes lowered assignments from the spec sample", () => {
    const behavior = compilePfScript(`
smile = interest * 0.4
mouthOpen = volume
`);
    const state = new StateStore();
    state.set("interest", 1);
    const channels = new ChannelStore();
    channels.set("volume", 0.5);

    const output = executeBehavior(behavior, {
      state,
      channels,
      renderedMotion: DEFAULT_MOTION_STATE,
      deltaTime: 0.016,
    });

    expect(output.mouthX).toBeCloseTo(0.4, 3);
    expect(output.mouthY).toBeCloseTo(0.5, 3);
  });

  it("compiles the full spec sample without errors", () => {
    const behavior = compilePfScript(SPEC_SAMPLE_PFSCRIPT);
    expect(behavior.statements.length).toBeGreaterThan(0);
  });

  it("executes phoneme lip-sync branches", () => {
    const behavior = compilePfScript(`
if currentPhoneme == "A" then
    MouthA = 1
end
`);
    const output = executeBehavior(behavior, {
      state: new StateStore(),
      channels: new ChannelStore(),
      renderedMotion: DEFAULT_MOTION_STATE,
      deltaTime: 0.016,
      currentPhoneme: "A",
    });

    expect(output.custom?.MouthA).toBeCloseTo(1, 3);
  });
});
