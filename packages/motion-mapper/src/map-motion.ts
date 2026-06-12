import { MOTION_STATE_KEYS, type MotionState } from "@puppetflow/core";
import { applyTransform } from "./transform.js";
import type { MappedMotion, MotionMapperProfile } from "./types.js";

export function mapMotion(
  motion: MotionState,
  profile: MotionMapperProfile,
): MappedMotion {
  const mapped: MappedMotion = {};

  for (const key of MOTION_STATE_KEYS) {
    const rule = profile.rules[key];
    if (!rule) {
      continue;
    }

    mapped[rule.param] = applyTransform(rule.transform, motion[key]);
  }

  return mapped;
}

export function createMotionMapper(profile: MotionMapperProfile) {
  return {
    profile,
    map(motion: MotionState): MappedMotion {
      return mapMotion(motion, profile);
    },
  };
}
