import live2dParams from "../profiles/live2d.json";
import vmcParams from "../profiles/vmc.json";
import vrmParams from "../profiles/vrm.json";
import { createProfile } from "./create-profile.js";
import type { ModelTarget, MotionMapperProfile, ParamNameMapping } from "./types.js";

export const VMC_PROFILE = createProfile(
  "vmc-default",
  "vmc",
  "VMC Generic",
  vmcParams as ParamNameMapping,
);

export const LIVE2D_PROFILE = createProfile(
  "live2d-default",
  "live2d",
  "Live2D Cubism",
  live2dParams as ParamNameMapping,
);

export const VRM_PROFILE = createProfile(
  "vrm-default",
  "vrm",
  "VRM BlendShape",
  vrmParams as ParamNameMapping,
);

const DEFAULT_PROFILES: Record<Exclude<ModelTarget, "custom">, MotionMapperProfile> = {
  vmc: VMC_PROFILE,
  live2d: LIVE2D_PROFILE,
  vrm: VRM_PROFILE,
};

export function getDefaultProfile(
  target: Exclude<ModelTarget, "custom">,
): MotionMapperProfile {
  return DEFAULT_PROFILES[target];
}

export function profileFromParamNames(
  target: ModelTarget,
  paramNames: ParamNameMapping,
  id = `${target}-custom`,
  label = `${target} custom`,
): MotionMapperProfile {
  return createProfile(id, target, label, paramNames);
}
