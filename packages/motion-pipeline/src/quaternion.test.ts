import { describe, expect, it } from "vitest";

import {
  quaternionDot,
  quaternionMultiply,
  quaternionNlerp,
  normalizeQuaternion,
} from "./quaternion.js";

describe("quaternion helpers", () => {
  it("normalizes a quaternion without changing its direction", () => {
    expect(normalizeQuaternion({ x: 0, y: 0, z: 0, w: 2 })).toEqual({
      x: 0,
      y: 0,
      z: 0,
      w: 1,
    });
  });

  it("multiplies rotations in quaternion order", () => {
    expect(
      quaternionMultiply({ x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: 0.5, z: 0, w: 0.5 }),
    ).toEqual({ x: 0, y: 0.5, z: 0, w: 0.5 });
  });

  it("uses the shortest hemisphere for normalized interpolation", () => {
    const result = quaternionNlerp(
      { x: 0, y: 0, z: 0, w: 1 },
      { x: 0, y: 0, z: 0, w: -1 },
      0.5,
    );

    expect(result).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    expect(quaternionDot(result, { x: 0, y: 0, z: 0, w: 1 })).toBeCloseTo(1);
  });

  it("clamps interpolation weight and returns a normalized quaternion", () => {
    const result = quaternionNlerp(
      { x: 0, y: 0, z: 0, w: 1 },
      { x: 0, y: 1, z: 0, w: 0 },
      2,
    );

    expect(result.y).toBeCloseTo(1);
    expect(result.w).toBeCloseTo(0);
  });
});
