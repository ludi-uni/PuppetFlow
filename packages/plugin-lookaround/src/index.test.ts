import { describe, expect, it } from "vitest";
import {
  createMotionRegistry,
  registerExtensionPlugins,
} from "@puppetflow/extension-core";
import { ChannelStore, StateStore, type MotionState } from "@puppetflow/core";
import { lookAroundExtensionPlugin } from "./index.js";

function baseMotion(): MotionState {
  return {
    faceYaw: 0.5,
    facePitch: 0.5,
    faceRoll: 0.5,
    bodyYaw: 0.5,
    bodyPitch: 0.5,
    bodyRoll: 0.5,
    eyeYaw: 0.5,
    eyePitch: 0.5,
    eyeX: 0.5,
    eyeY: 0.5,
    mouthX: 0,
    mouthY: 0,
    headTilt: 0.5,
    bodyLean: 0.5,
    lookX: 0.5,
    lookY: 0.5,
    custom: {},
  };
}

describe("plugin-lookaround", () => {
  it("lookAround pack produces standard motion output", () => {
    const registry = createMotionRegistry();
    registerExtensionPlugins(registry, [lookAroundExtensionPlugin]);
    const pack = registry.packs.get("lookAround");
    expect(pack).toBeDefined();

    const output = pack!.execute(
      {
        state: new StateStore(),
        channels: new ChannelStore(),
        deltaTime: 0.016,
        time: 2,
        timelineCurrentMs: 0,
        activeTimelineEvents: [],
        motion: baseMotion(),
        custom: {},
      },
      { intensity: 0.5 },
    );

    expect(output.standard).toBeDefined();
    expect(Object.keys(output.standard!).length).toBeGreaterThan(0);
  });

  it("lookAround generator produces standard motion output", () => {
    const registry = createMotionRegistry();
    registerExtensionPlugins(registry, [lookAroundExtensionPlugin]);
    const generator = registry.generators.get("lookAround");
    expect(generator).toBeDefined();

    const output = generator!.execute(
      {
        state: new StateStore(),
        channels: new ChannelStore(),
        deltaTime: 0.016,
        time: 2,
        timelineCurrentMs: 0,
        activeTimelineEvents: [],
        motion: baseMotion(),
        custom: {},
      },
      { intensity: 0.5 },
    );

    expect(output.standard?.lookX).not.toBe(0.5);
  });
});
