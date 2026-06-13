import { ChannelStore, DEFAULT_MOTION_STATE, StateStore } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import type { BehaviorBlock } from "./ast.js";
import { executeBehavior, executeBehaviorWithInvocations } from "./execute.js";

function createCtx(overrides: {
  state?: StateStore;
  channels?: ChannelStore;
} = {}) {
  return {
    state: overrides.state ?? new StateStore(),
    channels: overrides.channels ?? new ChannelStore(),
    renderedMotion: DEFAULT_MOTION_STATE,
    deltaTime: 0.016,
    time: 0,
    activeTimelineEvents: [],
  };
}

describe("executeBehavior", () => {
  it("runs If with Assign", () => {
    const state = new StateStore();
    state.set("interest", 0.8);

    const root: BehaviorBlock = {
      type: "Block",
      statements: [
        {
          type: "If",
          condition: { left: "interest", op: ">", right: 0.7 },
          then: [{ type: "Assign", key: "mouthX", op: "add", value: 0.2 }],
        },
      ],
    };

    const output = executeBehavior(root, createCtx({ state }));

    expect(output.mouthX).toBeCloseTo(0.2, 3);
  });

  it("evaluates numeric If conditions using channels", () => {
    const channels = new ChannelStore();
    channels.set("volume", 0.8);

    const root: BehaviorBlock = {
      type: "Block",
      statements: [
        {
          type: "If",
          condition: { left: "volume", op: ">", right: 0.5 },
          then: [
            {
              type: "ExprAssign",
              target: "mouthX",
              value: { type: "Number", value: 1 },
            },
          ],
        },
      ],
    };

    const output = executeBehavior(root, createCtx({ channels }));
    expect(output.mouthX).toBeCloseTo(1, 3);
  });

  it("collects MotionPack invocations only from executed branches", () => {
    const state = new StateStore();
    state.set("interest", 0.5);

    const root: BehaviorBlock = {
      type: "Block",
      statements: [
        {
          type: "If",
          condition: { left: "interest", op: ">", right: 0.7 },
          then: [{ type: "MotionPack", packId: "thinking", config: { intensity: 0.8 } }],
          else: [{ type: "MotionPack", packId: "idle", config: { strength: 0.3 } }],
        },
      ],
    };

    const falseBranch = executeBehaviorWithInvocations(root, createCtx({ state }));
    expect(falseBranch.packInvocations).toEqual([
      { packId: "idle", config: { strength: 0.3 } },
    ]);

    state.set("interest", 0.9);
    const trueBranch = executeBehaviorWithInvocations(root, createCtx({ state }));
    expect(trueBranch.packInvocations).toEqual([
      { packId: "thinking", config: { intensity: 0.8 } },
    ]);
  });
});
