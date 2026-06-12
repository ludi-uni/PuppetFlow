import { ChannelStore, DEFAULT_MOTION_STATE, StateStore } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import type { BehaviorBlock } from "./ast.js";
import { executeBehavior } from "./execute.js";

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

    const output = executeBehavior(root, {
      state,
      channels: new ChannelStore(),
      renderedMotion: DEFAULT_MOTION_STATE,
      deltaTime: 0.016,
    });

    expect(output.mouthX).toBeCloseTo(0.2, 3);
  });

  it("runs attention builtin", () => {
    const state = new StateStore();
    state.set("interest", 0.8);

    const root: BehaviorBlock = {
      type: "Block",
      statements: [{ type: "Builtin", id: "attention", config: { leanGain: 0.25 } }],
    };

    const output = executeBehavior(root, {
      state,
      channels: new ChannelStore(),
      renderedMotion: DEFAULT_MOTION_STATE,
      deltaTime: 0.016,
    });

    expect(output.bodyLean).toBeCloseTo(0.2, 3);
  });
});
