import { describe, expect, it } from "vitest";

import {
  blendBoneRotations,
  composeBoneRotation,
  identityPose,
  quaternionFromEuler,
} from "./rotation.js";

function lengthOf(quaternion: { x: number; y: number; z: number; w: number }): number {
  return Math.hypot(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
}

describe("acting rotation helpers", () => {
  it("creates identity poses for every requested bone", () => {
    expect(identityPose(["Head", "Chest"])).toEqual({
      Head: { x: 0, y: 0, z: 0, w: 1 },
      Chest: { x: 0, y: 0, z: 0, w: 1 },
    });
  });

  it("returns normalized Euler and composed rotations", () => {
    const offset = quaternionFromEuler({ x: 0.2, y: -0.4, z: 0.1 });
    const composed = composeBoneRotation(
      { x: 0, y: 0, z: 0, w: 2 },
      { x: offset.x * 3, y: offset.y * 3, z: offset.z * 3, w: offset.w * 3 },
    );

    expect(lengthOf(offset)).toBeCloseTo(1);
    expect(lengthOf(composed)).toBeCloseTo(1);
    expect(composed.x).toBeCloseTo(offset.x);
    expect(composed.y).toBeCloseTo(offset.y);
    expect(composed.z).toBeCloseTo(offset.z);
    expect(composed.w).toBeCloseTo(offset.w);
  });

  it("blends matching hemisphere rotations without cancelling opposite signs", () => {
    const result = blendBoneRotations(
      { Head: { x: 0, y: 0, z: 0, w: 1 } },
      { Head: { x: 0, y: 0, z: 0, w: -1 } },
      ["Head", "Chest"],
      0.5,
    );

    expect(result.Head).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    expect(result.Chest).toEqual({ x: 0, y: 0, z: 0, w: 1 });
  });
});
