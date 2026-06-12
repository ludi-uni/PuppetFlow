import { DEFAULT_MOTION_STATE } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import { NoiseModifier } from "./noise-modifier.js";

describe("NoiseModifier", () => {
  it("produces gradual offsets instead of frame-to-frame white noise", () => {
    const modifier = new NoiseModifier({ amplitude: 0.05, keys: ["mouthX"] });
    const target = { ...DEFAULT_MOTION_STATE, mouthX: 0.5 };
    const current = { ...DEFAULT_MOTION_STATE };

    const first = modifier.apply(current, target, 0.016);
    const second = modifier.apply(first, target, 0.016);

    expect(Math.abs(first.mouthX - 0.5)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(second.mouthX - first.mouthX)).toBeLessThan(0.02);
  });
});
