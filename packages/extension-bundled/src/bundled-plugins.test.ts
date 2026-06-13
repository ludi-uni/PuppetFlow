import { describe, expect, it, beforeEach } from "vitest";
import { ChannelStore, StateStore, type MotionState } from "@puppetflow/core";
import { executeExtensions } from "@puppetflow/extension-core";
import { getBundledMotionRegistry, resetBundledMotionRegistry } from "./index.js";

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

describe("bundled extension plugins", () => {
  beforeEach(() => {
    resetBundledMotionRegistry();
  });

  it.each([
    { packId: "thinking", expectKey: "standard" as const },
    { packId: "lookAround", expectKey: "standard" as const },
    { packId: "tailWag", expectKey: "custom" as const },
    { packId: "earTwitch", expectKey: "custom" as const },
  ])("smoke: $packId pack via executeExtensions", ({ packId, expectKey }) => {
    const registry = getBundledMotionRegistry();
    const result = executeExtensions(
      registry,
      {
        state: new StateStore(),
        channels: new ChannelStore(),
        deltaTime: 0.016,
        time: 2,
        timelineCurrentMs: 0,
        activeTimelineEvents: [],
        motion: baseMotion(),
      },
      {
        presetExtensions: {
          packs: [{ id: packId, config: { intensity: 0.8 } }],
        },
      },
    );

    if (expectKey === "standard") {
      expect(result.standard.lookX).not.toBe(0.5);
    } else {
      expect(Object.keys(result.custom).length).toBeGreaterThan(0);
    }
  });

  it("smoke: lookAround generator via executeExtensions", () => {
    const registry = getBundledMotionRegistry();
    const result = executeExtensions(
      registry,
      {
        state: new StateStore(),
        channels: new ChannelStore(),
        deltaTime: 0.016,
        time: 2,
        timelineCurrentMs: 0,
        activeTimelineEvents: [],
        motion: baseMotion(),
      },
      {
        graph: {
          nodes: [
            {
              id: "gen",
              type: "motionGenerator",
              data: { generatorId: "lookAround", intensity: 0.6 },
            },
          ],
          edges: [],
        },
      },
    );

    expect(result.standard.lookX).not.toBe(0.5);
  });

  it("smoke: ext:heartbeat node via executeExtensions", () => {
    const registry = getBundledMotionRegistry();
    const result = executeExtensions(
      registry,
      {
        state: new StateStore(),
        channels: new ChannelStore(),
        deltaTime: 0.016,
        time: 0.25,
        timelineCurrentMs: 0,
        activeTimelineEvents: [],
        motion: baseMotion(),
      },
      {
        graph: {
          nodes: [{ id: "hb", type: "ext:heartbeat", data: { amplitude: 0.2 } }],
          edges: [],
        },
      },
    );

    expect(result.standard.bodyLean).not.toBe(0.5);
  });
});
