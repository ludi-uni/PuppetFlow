import { describe, expect, it } from "vitest";
import { clamp01, StateStore, ChannelStore, type MotionState } from "@puppetflow/core";
import {
  collectExtensionInvocations,
  createMotionRegistry,
  executeExtensions,
  registerExtensionPlugins,
  type ExtensionPlugin,
} from "./index.js";

const mockThinkingPlugin: ExtensionPlugin = {
  id: "thinking",
  register(registry) {
    registry.addPack({
      id: "thinking",
      label: "Thinking",
      configFields: [
        { key: "intensity", label: "Intensity", type: "number", default: 0.8 },
      ],
      execute(_ctx, config) {
        return { standard: { lookX: clamp01(0.5 - (config.intensity ?? 0.8) * 0.1) } };
      },
    });
  },
};

const mockTailPlugin: ExtensionPlugin = {
  id: "tail",
  register(registry) {
    registry.addParameter({
      id: "tailWag",
      label: "Tail wag",
      type: "number",
      defaultValue: 0,
    });
    registry.addPack({
      id: "tailWag",
      label: "Tail wag",
      configFields: [
        { key: "intensity", label: "Intensity", type: "number", default: 0.7 },
      ],
      execute(ctx, config) {
        return {
          custom: {
            tailWag: clamp01(
              0.5 + Math.sin(ctx.time) * (config.intensity ?? 0.7) * 0.5,
            ),
          },
        };
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

describe("extension-core", () => {
  it("preserves motion.custom from upstream behavior when merging extension output", () => {
    const registry = createMotionRegistry();
    registerExtensionPlugins(registry, [mockTailPlugin]);

    const result = executeExtensions(
      registry,
      {
        state: new StateStore(),
        channels: new ChannelStore(),
        deltaTime: 0.016,
        time: 1,
        timelineCurrentMs: 0,
        activeTimelineEvents: [],
        motion: { ...baseMotion(), custom: { MouthA: 1 } },
      },
      {
        presetExtensions: {
          packs: [{ id: "tailWag", config: { intensity: 0.7 } }],
        },
      },
    );

    expect(result.standard.custom?.MouthA).toBeCloseTo(1, 3);
    expect(result.custom.MouthA).toBeCloseTo(1, 3);
    expect(result.custom.tailWag).toBeDefined();
  });

  it("executes motion packs and custom parameters", () => {
    const registry = createMotionRegistry();
    registerExtensionPlugins(registry, [mockThinkingPlugin, mockTailPlugin]);

    const result = executeExtensions(
      registry,
      {
        state: new StateStore(),
        channels: new ChannelStore(),
        deltaTime: 0.016,
        time: 1,
        timelineCurrentMs: 0,
        activeTimelineEvents: [],
        motion: baseMotion(),
      },
      {
        presetExtensions: {
          packs: [
            { id: "thinking", config: { intensity: 0.8 } },
            { id: "tailWag", config: { intensity: 0.7 } },
          ],
        },
        behavior: { type: "Block", statements: [] },
        graph: { nodes: [], edges: [] },
      },
    );

    expect(result.standard.lookX).not.toBe(0.5);
    expect(result.custom.tailWag).toBeDefined();
    expect(result.invocations).toHaveLength(2);
  });

  it("collects MotionPack statements from behavior", () => {
    const invocations = collectExtensionInvocations({
      behavior: {
        type: "Block",
        statements: [
          { type: "MotionPack", packId: "thinking", config: { intensity: 0.5 } },
        ],
      },
    });

    expect(invocations).toEqual([
      { kind: "pack", id: "thinking", config: { intensity: 0.5 } },
    ]);
  });

  it("prefers runtime behaviorPackInvocations over static behavior scan", () => {
    const invocations = collectExtensionInvocations({
      behavior: {
        type: "Block",
        statements: [
          { type: "MotionPack", packId: "thinking", config: { intensity: 0.5 } },
        ],
      },
      behaviorPackInvocations: [
        { kind: "pack", id: "idle", config: { strength: 0.2 } },
      ],
    });

    expect(invocations).toEqual([
      { kind: "pack", id: "idle", config: { strength: 0.2 } },
    ]);
  });

  it("executes ext: graph nodes without treating them as pack invocations", () => {
    const heartbeatPlugin: ExtensionPlugin = {
      id: "heartbeat",
      register(registry) {
        registry.addNode({
          type: "ext:heartbeat",
          label: "Heartbeat",
          configFields: [
            { key: "amplitude", label: "Amplitude", type: "number", default: 0.15 },
          ],
          execute(_ctx, _data, inputs) {
            const amplitude = inputs.amplitude ?? 0.15;
            return { standard: { bodyLean: clamp01(0.5 + amplitude) } };
          },
        });
      },
    };

    const registry = createMotionRegistry();
    registerExtensionPlugins(registry, [heartbeatPlugin]);

    const result = executeExtensions(
      registry,
      {
        state: new StateStore(),
        channels: new ChannelStore(),
        deltaTime: 0.016,
        time: 1,
        timelineCurrentMs: 0,
        activeTimelineEvents: [],
        motion: baseMotion(),
      },
      {
        graph: {
          nodes: [
            {
              id: "hb",
              type: "ext:heartbeat",
              data: { amplitude: 0.2 },
            },
          ],
          edges: [],
        },
      },
    );

    expect(result.standard.bodyLean).toBeGreaterThan(0.5);
    expect(result.invocations.some((inv) => inv.id === "heartbeat")).toBe(false);
  });

  it("does not collect motionFunction graph nodes as extension invocations", () => {
    const invocations = collectExtensionInvocations({
      graph: {
        nodes: [
          {
            id: "hb",
            type: "motionFunction",
            data: { functionName: "heartbeat", amplitude: 0.2 },
          },
        ],
        edges: [],
      },
    });

    expect(invocations).toEqual([]);
  });
});
