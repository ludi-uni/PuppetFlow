import type { MotionStateKey } from "./motion-state.js";

/** Legacy keys removed from MotionState — migrated automatically when loading presets */
export const LEGACY_MOTION_KEY_REPLACEMENTS: Readonly<
  Record<string, MotionStateKey>
> = {
  faceRoll: "headTilt",
  bodyPitch: "bodyLean",
  eyeX: "lookX",
  eyeY: "lookY",
};

export function migrateLegacyMotionKey(key: string): {
  key: string;
  migrated: boolean;
} {
  const replacement = LEGACY_MOTION_KEY_REPLACEMENTS[key];
  if (replacement) {
    return { key: replacement, migrated: true };
  }
  return { key, migrated: false };
}

/** Official behaviorPlugins → MotionState keys they may output */
export const PLUGIN_MOTION_OUTPUTS: Readonly<
  Record<string, readonly MotionStateKey[]>
> = {
  gaze: ["lookX", "lookY"],
  blink: ["eyeYaw"],
  idle: ["lookX", "lookY"],
  attention: ["bodyLean", "headTilt"],
  emotion: ["mouthX", "facePitch", "lookX"],
};
