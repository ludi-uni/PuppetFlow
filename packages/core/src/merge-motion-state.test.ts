import { describe, expect, it } from "vitest";
import { DEFAULT_MOTION_STATE } from "./motion-state.js";
import { mergeMotionState } from "./merge-motion-state.js";

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
