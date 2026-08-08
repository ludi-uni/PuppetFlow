import { describe, expect, it } from "vitest";

import { calculateRateHz } from "./motion-inspector.js";

describe("calculateRateHz", () => {
  it("returns zero when the window has no events", () => {
    expect(calculateRateHz([], 1000)).toBe(0);
    expect(calculateRateHz([0], 2000)).toBe(0);
  });

  it("counts events in the bounded one-second window", () => {
    expect(calculateRateHz([1000], 1000)).toBe(1);
    expect(calculateRateHz([500, 900, 1000], 1000)).toBe(3);
    expect(calculateRateHz([0, 500, 1000], 1000)).toBe(2);
  });
});
