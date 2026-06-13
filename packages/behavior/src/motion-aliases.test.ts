import { describe, expect, it } from "vitest";
import { formatAssignTarget, resolveAssignTarget } from "./motion-aliases.js";

describe("motion-aliases", () => {
  it("maps legacy motion names removed from MotionState", () => {
    expect(resolveAssignTarget("faceRoll")).toBe("headTilt");
    expect(resolveAssignTarget("bodyPitch")).toBe("bodyLean");
    expect(formatAssignTarget("eyeX")).toBe("lookX");
    expect(formatAssignTarget("eyeY")).toBe("lookY");
  });
});
