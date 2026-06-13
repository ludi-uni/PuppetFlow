import { MOTION_STATE_KEYS, type MotionStateKey } from "@puppetflow/core";
import type {
  MappingRule,
  ModelTarget,
  MotionMapperProfile,
  ParamNameMapping,
  ValueTransform,
} from "./types.js";

const BASE_CENTERED_MOTION_KEYS = [
  "faceYaw",
  "facePitch",
  "bodyYaw",
  "bodyRoll",
  "headTilt",
  "bodyLean",
  "lookX",
  "lookY",
] as const satisfies readonly MotionStateKey[];

function centeredTransforms(
  keys: readonly MotionStateKey[],
): Partial<Record<MotionStateKey, ValueTransform>> {
  return Object.fromEntries(keys.map((key) => [key, "centered"])) as Partial<
    Record<MotionStateKey, ValueTransform>
  >;
}

const TARGET_DEFAULT_TRANSFORMS: Record<
  ModelTarget,
  Partial<Record<MotionStateKey, ValueTransform>>
> = {
  vmc: {
    ...centeredTransforms(BASE_CENTERED_MOTION_KEYS),
    eyeYaw: "identity",
    eyePitch: "identity",
  },
  live2d: {
    ...centeredTransforms(BASE_CENTERED_MOTION_KEYS),
    eyeYaw: "identity",
    eyePitch: "identity",
  },
  vrm: {
    ...centeredTransforms(BASE_CENTERED_MOTION_KEYS),
    eyeYaw: "identity",
    eyePitch: "identity",
  },
  custom: {},
};

export function createProfile(
  id: string,
  target: ModelTarget,
  label: string,
  paramNames: ParamNameMapping,
  transformOverrides: Partial<Record<MotionStateKey, ValueTransform>> = {},
): MotionMapperProfile {
  const defaults = TARGET_DEFAULT_TRANSFORMS[target];
  const rules: Partial<Record<MotionStateKey, MappingRule>> = {};

  for (const key of MOTION_STATE_KEYS) {
    const param = paramNames[key]?.trim();
    if (!param) {
      continue;
    }

    rules[key] = {
      param,
      transform: transformOverrides[key] ?? defaults[key] ?? "identity",
    };
  }

  return { id, target, label, rules };
}

export function profileToParamNames(
  profile: MotionMapperProfile,
): Record<MotionStateKey, string> {
  return Object.fromEntries(
    MOTION_STATE_KEYS.map((key) => [key, profile.rules[key]?.param ?? ""]),
  ) as Record<MotionStateKey, string>;
}

export function profileToTransforms(
  profile: MotionMapperProfile,
): Record<MotionStateKey, ValueTransform> {
  return Object.fromEntries(
    MOTION_STATE_KEYS.map((key) => [key, profile.rules[key]?.transform ?? "identity"]),
  ) as Record<MotionStateKey, ValueTransform>;
}

export function rebuildProfile(
  id: string,
  target: ModelTarget,
  label: string,
  paramNames: Record<MotionStateKey, string>,
  transforms: Record<MotionStateKey, ValueTransform>,
): MotionMapperProfile {
  const mapping: ParamNameMapping = {};
  const transformOverrides: Partial<Record<MotionStateKey, ValueTransform>> = {};

  for (const key of MOTION_STATE_KEYS) {
    const param = paramNames[key]?.trim();
    if (!param) {
      continue;
    }

    mapping[key] = param;
    transformOverrides[key] = transforms[key] ?? "identity";
  }

  return createProfile(id, target, label, mapping, transformOverrides);
}
