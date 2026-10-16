import { describe, expect, it } from "vitest";

import { VMC_INPUT_PROFILES, resolveVmcInputProfile } from "./profiles.js";

const MAJOR_BONES = [
  "Hips",
  "Spine",
  "Chest",
  "Neck",
  "Head",
  "LeftUpperArm",
  "LeftLowerArm",
  "LeftHand",
  "RightUpperArm",
  "RightLowerArm",
  "RightHand",
  "LeftUpperLeg",
  "LeftLowerLeg",
  "LeftFoot",
  "RightUpperLeg",
  "RightLowerLeg",
  "RightFoot",
] as const;

describe("VMC input profiles", () => {
  it.each(["generic-vmc", "slimevr-compatible", "mocopi-compatible"] as const)(
    "loads %s with canonical humanoid bones",
    (id) => {
      const profile = resolveVmcInputProfile(id);

      expect(profile.id).toBe(id);
      expect(profile.expectedBones).toEqual(expect.arrayContaining([...MAJOR_BONES]));
      expect(profile.optionalBones).toContain("UpperChest");
      expect(profile.positionScale).toBe(1);
      expect(profile.coordinate).toBe("vmc-unity");
    },
  );

  it("keeps generic VMC as the default behavior", () => {
    expect(resolveVmcInputProfile()).toEqual(VMC_INPUT_PROFILES["generic-vmc"]);
  });

  it("uses only confirmed root-policy differences", () => {
    expect(resolveVmcInputProfile("slimevr-compatible").rootPolicy).toBe("hips-only");
    expect(resolveVmcInputProfile("mocopi-compatible").rootPolicy).toBe("preserve");
  });

  it("applies manual overrides after preset defaults", () => {
    const profile = resolveVmcInputProfile("slimevr-compatible", {
      positionScale: 1.25,
      rootPolicy: "preserve",
    });

    expect(profile.positionScale).toBe(1.25);
    expect(profile.rootPolicy).toBe("preserve");
    expect(profile.id).toBe("slimevr-compatible");
  });
});
