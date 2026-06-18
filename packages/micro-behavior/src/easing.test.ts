import { describe, expect, it } from "vitest";

import { easeInOutCubic, interpolateEaseInOut } from "./easing.js";

describe("easing", () => {
  it("easeInOutCubic slows at the start of the curve", () => {
    const eased = easeInOutCubic(0.25);
    expect(eased).not.toBe(0.25);
    expect(eased).toBeLessThan(0.25);
    expect(eased).toBeCloseTo(0.0625, 5);
  });

  it("interpolateEaseInOut reaches endpoints", () => {
    expect(interpolateEaseInOut(0, 1, 0)).toBe(0);
    expect(interpolateEaseInOut(0, 1, 1)).toBe(1);
  });
});
