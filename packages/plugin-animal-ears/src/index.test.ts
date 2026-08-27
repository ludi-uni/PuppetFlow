import { describe, expect, it } from "vitest";
import {
  createMotionRegistry,
  registerExtensionPlugins,
} from "@puppetflow/extension-core";
import { ChannelStore, StateStore, type MotionState } from "@puppetflow/core";
import {
  createRuntimeStatefulRegistry,
  StatefulStore,
} from "@puppetflow/stateful-core";
import { animalEarsExtensionPlugin } from "./index.js";

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

describe("plugin-animal-ears", () => {
  it("earTwitch pack produces custom earAngle output", () => {
    const registry = createMotionRegistry();
    registerExtensionPlugins(registry, [animalEarsExtensionPlugin]);
    const pack = registry.packs.get("earTwitch");
    expect(pack).toBeDefined();

    const output = pack!.execute(
      {
        state: new StateStore(),
        channels: new ChannelStore(),
        deltaTime: 0.016,
        time: 1.2,
        timelineCurrentMs: 0,
        activeTimelineEvents: [],
        motion: baseMotion(),
        custom: {},
      },
      { intensity: 0.4 },
    );

    expect(output.custom?.earAngle).toBeDefined();
    expect(output.custom!.earAngle).toBeGreaterThanOrEqual(0);
    expect(output.custom!.earAngle).toBeLessThanOrEqual(1);
  });

  it("uses earPhysics when a runtime Stateful context is provided", () => {
    const registry = createMotionRegistry();
    registerExtensionPlugins(registry, [animalEarsExtensionPlugin]);
    const pack = registry.packs.get("earTwitch");
    const statefulStore = new StatefulStore();
    const statefulRegistry = createRuntimeStatefulRegistry();

    pack!.execute(
      {
        state: new StateStore(),
        channels: new ChannelStore(),
        deltaTime: 1 / 60,
        time: 0,
        timelineCurrentMs: 0,
        activeTimelineEvents: [],
        motion: baseMotion(),
        custom: {},
        statefulStore,
        statefulRegistry,
        frame: { deltaTime: 1 / 60, frameNumber: 0, elapsedTime: 0 },
      },
      { intensity: 0.4 },
    );

    expect(statefulStore.snapshot()).toEqual([
      expect.objectContaining({
        functionName: "earPhysics",
        instanceId: "earTwitch",
      }),
    ]);
  });
});
