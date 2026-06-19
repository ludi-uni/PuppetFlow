import { MOTION_STATE_KEYS, type MotionStateKey } from "@puppetflow/core";
import {
  createProfile,
  type ModelTarget,
  type MotionMapperProfile,
  type ValueTransform,
} from "@puppetflow/motion-mapper";

import type { OscAdapterLaunchConfig } from "./types.js";

export type OscAdapterTarget = Exclude<ModelTarget, "custom">;

export function buildMotionMapperProfileFromLaunch(
  target: OscAdapterTarget,
  config: OscAdapterLaunchConfig,
): MotionMapperProfile | undefined {
  if (!config.params || Object.keys(config.params).length === 0) {
    return undefined;
  }

  const mapping: Partial<Record<MotionStateKey, string>> = {};
  const transformOverrides: Partial<Record<MotionStateKey, ValueTransform>> = {};

  for (const key of MOTION_STATE_KEYS) {
    const param = config.params[key]?.trim();
    if (!param) {
      continue;
    }
    mapping[key] = param;
    const transform = config.transforms?.[key];
    if (transform !== undefined) {
      transformOverrides[key] = transform;
    }
  }

  if (Object.keys(mapping).length === 0) {
    return undefined;
  }

  return createProfile(
    `${target}-launch`,
    target,
    `${target.toUpperCase()} Launch`,
    mapping,
    transformOverrides,
  );
}

export function customMappingsFromLaunch(config: OscAdapterLaunchConfig): {
  customParams: Record<string, string>;
  customTransforms: Record<string, ValueTransform>;
} {
  const customParams: Record<string, string> = {};
  const customTransforms: Record<string, ValueTransform> = {};

  for (const [key, entry] of Object.entries(config.custom ?? {})) {
    customParams[key] = entry.param;
    if (entry.transform) {
      customTransforms[key] = entry.transform;
    }
  }

  return { customParams, customTransforms };
}
