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
