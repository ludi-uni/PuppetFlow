import { describe, expect, it } from "vitest";

import { applyRetarget } from "./retarget.js";

describe("applyRetarget", () => {
  it("maps bones and applies rotation, position, and scale offsets", () => {
    const result = applyRetarget(
      {
        timestamp: 42,
        metadata: { sourceId: "tracking" },
        bones: {
          InputArm: {
            position: { x: 1, y: 2, z: 3 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
          },
        },
      },
      {
        mapping: { InputArm: "LeftUpperArm" },
        bones: {
          InputArm: {
            scale: 2,
            positionOffset: { x: 1, y: -1, z: 0.5 },
            rotationOffset: { x: 0, y: 0.70710678, z: 0, w: 0.70710678 },
          },
        },
      },
    );

    expect(result.timestamp).toBe(42);
    expect(result.metadata).toEqual({ sourceId: "tracking" });
    expect(result.bones).toEqual({
      LeftUpperArm: {
        position: { x: 3, y: 3, z: 6.5 },
        rotation: { x: 0, y: 0.70710678, z: 0, w: 0.70710678 },
      },
    });
  });

  it("keeps unmapped and unknown bones and preserves partial transforms", () => {
    const result = applyRetarget(
      {
        timestamp: 1,
        bones: {
          Head: { rotation: { x: 0, y: 0, z: 0, w: 1 }, confidence: 0.8 },
          UnknownBone: { position: { x: 1, y: 0, z: 0 } },
        },
      },
      { mapping: { Head: "Neck" } },
    );

    expect(result.bones?.Neck).toEqual({
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      confidence: 0.8,
    });
    expect(result.bones?.UnknownBone).toEqual({
      position: { x: 1, y: 0, z: 0 },
    });
  });

  it("merges partial transforms when two inputs map to one output bone", () => {
    const result = applyRetarget(
      {
        timestamp: 1,
        bones: {
          Position: { position: { x: 1, y: 0, z: 0 } },
          Rotation: { rotation: { x: 0, y: 0, z: 0, w: 1 } },
        },
      },
      { mapping: { Position: "Head", Rotation: "Head" } },
    );

    expect(result.bones?.Head).toEqual({
      position: { x: 1, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    });
  });
});
