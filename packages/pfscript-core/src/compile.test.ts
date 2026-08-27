import { ChannelStore, DEFAULT_MOTION_STATE, StateStore } from "@puppetflow/core";
import { executeBehavior, executeBehaviorWithInvocations } from "@puppetflow/behavior";
import { describe, expect, it, vi } from "vitest";
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

  it("compiles and executes let declarations without dropping local bindings", () => {
    const behavior = compilePfScript(`
let pulse = heartbeat(amplitude = interest * 0.2)
bodyLean = pulse
if interest > 0.5 then
  thinking(intensity = interest * 0.5)
end
`);
    const state = new StateStore();
    state.set("interest", 0.8);

    const evaluateExtensionFunction = vi.fn(() => 0.7);
    const result = executeBehaviorWithInvocations(behavior, {
      state,
      channels: new ChannelStore(),
      renderedMotion: DEFAULT_MOTION_STATE,
      deltaTime: 0.016,
      evaluateExtensionFunction,
    });

    expect(result.motion.bodyLean).toBeCloseTo(0.7, 3);
    expect(evaluateExtensionFunction).toHaveBeenCalledWith(
      "heartbeat",
      expect.objectContaining({ amplitude: expect.any(Number) }),
    );
    expect(
      (evaluateExtensionFunction.mock.calls[0]?.[1] as Record<string, number>)
        .amplitude,
    ).toBeCloseTo(0.16, 3);
    expect(result.packInvocations).toEqual([
      { packId: "thinking", config: { intensity: 0.4 } },
    ]);
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
