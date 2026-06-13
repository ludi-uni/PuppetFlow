import { describe, expect, it } from "vitest";
import { DEFAULT_MOTION_STATE } from "./motion-state.js";
import { mergeMotionState, addMotionState } from "./merge-motion-state.js";

describe("mergeMotionState", () => {
  it("averages values for the same key across partials", () => {
    const result = mergeMotionState(DEFAULT_MOTION_STATE, [
      { mouthX: 0.4 },
      { mouthX: 0.6 },
    ]);

    expect(result.mouthX).toBe(0.5);
  });

  it("keeps base values when a key is absent from partials", () => {
    const result = mergeMotionState(DEFAULT_MOTION_STATE, [{ headTilt: 0.2 }]);

    expect(result.facePitch).toBe(0.5);
    expect(result.headTilt).toBe(0.2);
  });

  it("clamps averaged values to 0-1", () => {
    const result = mergeMotionState(DEFAULT_MOTION_STATE, [
      { mouthX: 1.5 },
      { mouthX: 2 },
    ]);

    expect(result.mouthX).toBe(1);
  });
});

describe("addMotionState", () => {
  it("adds zero-based keys from neutral", () => {
    const result = addMotionState(DEFAULT_MOTION_STATE, [
      { mouthX: 0.4 },
      { mouthX: 0.3 },
    ]);

    expect(result.mouthX).toBe(0.7);
  });

  it("adds centered keys as deltas from 0.5", () => {
    const result = addMotionState(DEFAULT_MOTION_STATE, [
      { lookX: 0.55 },
      { lookX: 0.48 },
    ]);

    expect(result.lookX).toBeCloseTo(0.53, 5);
  });

  it("keeps base values when a key is absent from partials", () => {
    const result = addMotionState(DEFAULT_MOTION_STATE, [{ headTilt: 0.2 }]);

    expect(result.lookX).toBe(0.5);
    expect(result.headTilt).toBe(0.2);
  });

  it("clamps summed values to 0-1", () => {
    const result = addMotionState(DEFAULT_MOTION_STATE, [
      { mouthX: 0.8 },
      { mouthX: 0.6 },
    ]);

    expect(result.mouthX).toBe(1);
  });
});
