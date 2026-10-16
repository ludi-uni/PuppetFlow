import type { MotionRetargetProfile } from "@puppetflow/motion-pipeline";

export const VMC_INPUT_PROFILE_IDS = [
  "generic-vmc",
  "slimevr-compatible",
  "mocopi-compatible",
  "custom",
] as const;

export type VmcInputProfileId = (typeof VMC_INPUT_PROFILE_IDS)[number];
export type VmcRootPolicy = "preserve" | "hips-only";

export interface VmcInputProfile {
  id: VmcInputProfileId;
  displayName: string;
  description: string;
  expectedBones: readonly string[];
  optionalBones: readonly string[];
  rootPolicy: VmcRootPolicy;
  coordinate: "vmc-unity";
  positionScale: number;
  retarget?: MotionRetargetProfile;
}

export interface VmcInputProfileOverrides {
  positionScale?: number;
  rootPolicy?: VmcRootPolicy;
  retarget?: MotionRetargetProfile;
}

const EXPECTED_HUMANOID_BONES = [
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

const OPTIONAL_HUMANOID_BONES = [
  "UpperChest",
  "LeftToes",
  "RightToes",
  "LeftEye",
  "RightEye",
] as const;

const GENERIC: VmcInputProfile = {
  id: "generic-vmc",
  displayName: "Generic VMC",
  description: "Standard VMC humanoid bone input without source-specific correction.",
  expectedBones: EXPECTED_HUMANOID_BONES,
  optionalBones: OPTIONAL_HUMANOID_BONES,
  rootPolicy: "preserve",
  coordinate: "vmc-unity",
  positionScale: 1,
};

export const VMC_INPUT_PROFILES: Readonly<Record<VmcInputProfileId, VmcInputProfile>> =
  {
    "generic-vmc": GENERIC,
    "slimevr-compatible": {
      ...GENERIC,
      id: "slimevr-compatible",
      displayName: "SlimeVR-compatible",
      description:
        "Unofficial VMC profile for rotation/FK full-body sources; variable tracker sets are accepted.",
      rootPolicy: "hips-only",
    },
    "mocopi-compatible": {
      ...GENERIC,
      id: "mocopi-compatible",
      displayName: "mocopi-compatible",
      description:
        "Unofficial VMC profile for solved mocopi-like full-body motion with root translation preserved.",
    },
    custom: {
      ...GENERIC,
      id: "custom",
      displayName: "Custom",
      description: "Generic VMC defaults with explicit user overrides.",
    },
  };

export function resolveVmcInputProfile(
  id: VmcInputProfileId = "generic-vmc",
  overrides: VmcInputProfileOverrides = {},
): VmcInputProfile {
  const base = VMC_INPUT_PROFILES[id];
  if (!base) {
    throw new Error(`Unknown VMC input profile: ${String(id)}`);
  }

  const positionScale = overrides.positionScale ?? base.positionScale;
  if (!Number.isFinite(positionScale) || positionScale <= 0) {
    throw new Error("VMC input positionScale must be a positive finite number");
  }

  return {
    ...base,
    positionScale,
    rootPolicy: overrides.rootPolicy ?? base.rootPolicy,
    retarget: overrides.retarget ?? base.retarget,
  };
}
