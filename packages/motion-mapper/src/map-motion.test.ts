import { DEFAULT_MOTION_STATE } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import { mapCustomMotion, mapMotion } from "./map-motion.js";
import { LIVE2D_PROFILE, VMC_PROFILE, VRM_PROFILE } from "./profiles.js";

describe("mapMotion", () => {
  it("maps centered gaze for VMC", () => {
    const mapped = mapMotion(
      { ...DEFAULT_MOTION_STATE, lookX: 0.5, lookY: 1 },
      VMC_PROFILE,
    );

    expect(mapped.ParamEyeBallX).toBe(0);
    expect(mapped.ParamEyeBallY).toBe(1);
    expect(mapped.ParamEyeOpen).toBe(1);
    expect(mapped.ParamEyeSmile).toBe(0);
  });

  it("keeps eyelid and eye smile separate from eyeball direction", () => {
    const mapped = mapMotion(
      { ...DEFAULT_MOTION_STATE, lookX: 0.75, lookY: 0.25, eyeYaw: 0.2, eyePitch: 0.8 },
      VMC_PROFILE,
    );

    expect(mapped.ParamEyeBallX).toBe(0.5);
    expect(mapped.ParamEyeBallY).toBe(-0.5);
    expect(mapped.ParamEyeOpen).toBe(0.2);
    expect(mapped.ParamEyeSmile).toBe(0.8);
  });

  it("maps Live2D mouth form via mouthX", () => {
    const mapped = mapMotion({ ...DEFAULT_MOTION_STATE, mouthX: 0.75 }, LIVE2D_PROFILE);

    expect(mapped.ParamMouthForm).toBe(0.75);
  });

  it("maps VRM smile via mouthX", () => {
    const mapped = mapMotion({ ...DEFAULT_MOTION_STATE, mouthX: 0.8 }, VRM_PROFILE);

    expect(mapped.Fcl_MTH_Smile).toBe(0.8);
  });
});

describe("mapCustomMotion", () => {
  it("maps MotionState.custom keys to OSC params", () => {
    const mapped = mapCustomMotion(
      { ...DEFAULT_MOTION_STATE, custom: { tailWag: 0.75 } },
      { tailWag: "ParamTail" },
    );

    expect(mapped.ParamTail).toBe(0.75);
  });

  it("skips empty param names and undefined custom values", () => {
    const mapped = mapCustomMotion(
      { ...DEFAULT_MOTION_STATE, custom: { tailWag: 0.5 } },
      { tailWag: "", earAngle: "ParamEar" },
    );

    expect(mapped).toEqual({});
  });
});
