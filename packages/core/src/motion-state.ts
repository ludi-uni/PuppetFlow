export interface MotionState {
  faceYaw: number;
  facePitch: number;
  bodyYaw: number;
  bodyRoll: number;
  eyeYaw: number;
  eyePitch: number;
  mouthX: number;
  mouthY: number;
  headTilt: number;
  bodyLean: number;
  lookX: number;
  lookY: number;
  /** Extension Layer が書き込む独自パラメータ */
  custom: Record<string, number>;
}

export const MOTION_STATE_KEYS = [
  "faceYaw",
  "facePitch",
  "bodyYaw",
  "bodyRoll",
  "eyeYaw",
  "eyePitch",
  "mouthX",
  "mouthY",
  "headTilt",
  "bodyLean",
  "lookX",
  "lookY",
] as const;

export type MotionStateKey = (typeof MOTION_STATE_KEYS)[number];

export const DEFAULT_MOTION_STATE: MotionState = {
  faceYaw: 0.5,
  facePitch: 0.5,
  bodyYaw: 0.5,
  bodyRoll: 0.5,
  eyeYaw: 1,
  eyePitch: 0,
  mouthX: 0,
  mouthY: 0,
  headTilt: 0.5,
  bodyLean: 0.5,
  lookX: 0.5,
  lookY: 0.5,
  custom: {},
};

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Legacy keys removed from MotionState — migrated automatically when loading presets */
export const LEGACY_MOTION_KEY_REPLACEMENTS: Readonly<Record<string, MotionStateKey>> =
  {
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

/** Official preset policy: blink + idle only */
export const OFFICIAL_BEHAVIOR_PLUGIN_IDS = ["blink", "idle"] as const;

export type OfficialBehaviorPluginId = (typeof OFFICIAL_BEHAVIOR_PLUGIN_IDS)[number];

/** Custom / advanced presets — overlap easily with PFScript or Graph */
export const LEGACY_BEHAVIOR_PLUGIN_IDS = ["gaze", "attention", "emotion"] as const;

export type LegacyBehaviorPluginId = (typeof LEGACY_BEHAVIOR_PLUGIN_IDS)[number];

export function getPluginMotionOutputs(pluginId: string): readonly MotionStateKey[] {
  return PLUGIN_MOTION_OUTPUTS[pluginId] ?? [];
}
