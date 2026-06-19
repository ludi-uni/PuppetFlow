import { describe, expect, it } from "vitest";

import {
  buildMotionMapperProfileFromLaunch,
  customMappingsFromLaunch,
} from "./mapper-launch.js";

describe("mapper-launch", () => {
  it("builds a profile from launch mapper config", () => {
    const profile = buildMotionMapperProfileFromLaunch("vmc", {
      params: {
        mouthX: "Jaw",
        lookX: "EyeX",
      },
      transforms: {
        lookX: "centered",
      },
    });

    expect(profile?.rules.mouthX).toEqual({
      param: "Jaw",
      transform: "identity",
    });
    expect(profile?.rules.lookX).toEqual({
      param: "EyeX",
      transform: "centered",
    });
  });

  it("extracts custom mappings from launch config", () => {
    const custom = customMappingsFromLaunch({
      custom: {
        MouthA: { param: "ParamMouthA", transform: "invert" },
      },
    });

    expect(custom.customParams.MouthA).toBe("ParamMouthA");
    expect(custom.customTransforms.MouthA).toBe("invert");
  });
});
