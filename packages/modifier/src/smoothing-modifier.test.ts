import { DEFAULT_MOTION_STATE } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import { SmoothingModifier } from "./smoothing-modifier.js";

describe("SmoothingModifier", () => {
  it("lerps current values toward target", () => {
    const modifier = new SmoothingModifier({ factor: 0.5 });
    const current = { ...DEFAULT_MOTION_STATE, mouthX: 0 };
    const target = { ...DEFAULT_MOTION_STATE, mouthX: 1 };

    const result = modifier.apply(current, target, 1 / 60);

    expect(result.mouthX).toBeCloseTo(0.5, 5);
  });
});
