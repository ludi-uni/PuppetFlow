import { describe, expect, it } from "vitest";
import { evaluatePfScriptExpression, parsePfScriptCall } from "./index.js";
import {
  createMotionRegistry,
  registerExtensionPlugins,
  type ExtensionPlugin,
} from "@puppetflow/extension-core";
import { clamp01, ChannelStore, StateStore, type MotionState } from "@puppetflow/core";

const heartbeatFunctionPlugin: ExtensionPlugin = {
  id: "heartbeatFn",
  register(registry) {
    registry.addFunction({
      name: "heartbeat",
      label: "Heartbeat",
      execute(_ctx, args) {
        return clamp01(0.5 + (args.amplitude ?? 0.15));
      },
    });
  },
};

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

describe("pfscript-core", () => {
  it("parses named function calls", () => {
    expect(parsePfScriptCall("heartbeat(amplitude=0.2)")).toEqual({
      name: "heartbeat",
      args: { amplitude: 0.2 },
    });
  });

  it("returns null for invalid expressions", () => {
    expect(parsePfScriptCall("not a call")).toBeNull();
  });

  it("evaluates registered PFScript functions", () => {
    const registry = createMotionRegistry();
    registerExtensionPlugins(registry, [heartbeatFunctionPlugin]);

    const value = evaluatePfScriptExpression(
      registry,
      {
        state: new StateStore(),
        channels: new ChannelStore(),
        deltaTime: 0.016,
        time: 0,
        timelineCurrentMs: 0,
        activeTimelineEvents: [],
        motion: baseMotion(),
        custom: {},
      },
      "heartbeat(amplitude=0.1)",
    );

    expect(value).toBeCloseTo(0.6);
  });
});
