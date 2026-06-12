import { DEFAULT_MOTION_STATE } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import { mapMotion } from "./map-motion.js";
import { LIVE2D_PROFILE, VMC_PROFILE, VRM_PROFILE } from "./profiles.js";

describe("mapMotion", () => {
  it("maps centered gaze for VMC", () => {
    const mapped = mapMotion(
      { ...DEFAULT_MOTION_STATE, lookX: 0.5, lookY: 1 },
      VMC_PROFILE,
    );

    expect(mapped.ParamEyeBallX).toBe(0);
    expect(mapped.ParamEyeBallY).toBe(1);
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
