import { describe, expect, it } from "vitest";
import {
  createMotionRegistry,
  registerExtensionPlugins,
} from "@puppetflow/extension-core";
import { ChannelStore, StateStore, type MotionState } from "@puppetflow/core";
import { tailExtensionPlugin } from "./index.js";

function baseMotion(): MotionState {
  return {
    faceYaw: 0.5,
    facePitch: 0.5,
    bodyYaw: 0.5,
    bodyRoll: 0.5,
    eyeYaw: 0.5,
    eyePitch: 0.5,
    mouthX: 0,
    mouthY: 0,
    headTilt: 0.5,
    bodyLean: 0.5,
    lookX: 0.5,
    lookY: 0.5,
    custom: {},
  };
}

describe("plugin-tail", () => {
  it("tailWag pack produces custom tailWag output", () => {
    const registry = createMotionRegistry();
    registerExtensionPlugins(registry, [tailExtensionPlugin]);
    const pack = registry.packs.get("tailWag");
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
      { intensity: 0.7 },
    );

    expect(output.custom?.tailWag).toBeDefined();
    expect(output.custom!.tailWag).toBeGreaterThanOrEqual(0);
    expect(output.custom!.tailWag).toBeLessThanOrEqual(1);
  });
});
