import { describe, expect, it } from "vitest";
import { cloneMotionFrame, normalizeMotionFrame } from "./motion-frame.js";

describe("MotionFrame", () => {
  it("accepts blendshape-only, bone-only, mixed, partial, and unknown bones", () => {
    const frame = normalizeMotionFrame({
      timestamp: 16,
      bones: {
        UnknownBone: { rotation: { x: 0, y: 0, z: 0, w: 1 } },
      },
      blendShapes: { Smile: 0.4 },
    });

    expect(frame.bones?.UnknownBone.rotation?.w).toBe(1);
    expect(frame.blendShapes?.Smile).toBe(0.4);
  });

  it("rejects non-finite timestamps and clones nested records", () => {
    expect(() => normalizeMotionFrame({ timestamp: Number.NaN })).toThrow();

    const original = normalizeMotionFrame({
      timestamp: 0,
      bones: { Head: {} },
    });
    const copy = cloneMotionFrame(original);

    expect(copy).not.toBe(original);
    expect(copy.bones).not.toBe(original.bones);
    expect(copy.bones?.Head).not.toBe(original.bones?.Head);
  });
});
