import { describe, expect, it } from "vitest";
import {
  formatAssignTarget,
  resolveAssignTarget,
  resolveMotionAlias,
} from "./motion-aliases.js";

describe("motion-aliases", () => {
  it("maps legacy motion names removed from MotionState", () => {
    expect(resolveAssignTarget("faceRoll")).toBe("headTilt");
    expect(resolveAssignTarget("bodyPitch")).toBe("bodyLean");
    expect(formatAssignTarget("eyeX")).toBe("lookX");
    expect(formatAssignTarget("eyeY")).toBe("lookY");
  });

  it("keeps aliases case-sensitive and sends unknown names to custom", () => {
    expect(resolveMotionAlias("smile")).toBe("mouthX");
    expect(resolveMotionAlias("faceRoll")).toBe("headTilt");
    expect(resolveMotionAlias("Smile")).toBeUndefined();
    expect(resolveAssignTarget("MouthA")).toEqual({ custom: "MouthA" });
  });
});
