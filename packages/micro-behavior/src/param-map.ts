import { clamp01, type MotionState, type MotionStateKey } from "@puppetflow/core";

/** Spec-relative param → MotionState key */
const SPEC_PARAM_TO_MOTION_KEY: Record<string, MotionStateKey> = {
  eyeY: "lookY",
  eyeX: "lookX",
  lookX: "lookX",
  lookY: "lookY",
  eyeOpen: "eyeYaw",
  headTilt: "headTilt",
  facePitch: "facePitch",
  faceYaw: "faceYaw",
};

/** MotionState neutral for offset-based params (spec value 0 = neutral) */
const NEUTRAL_CENTERED: Partial<Record<MotionStateKey, number>> = {
  lookX: 0.5,
  lookY: 0.5,
  headTilt: 0.5,
  facePitch: 0.5,
  faceYaw: 0.5,
};

/** Passed through as clamped absolute MotionState values */
const ABSOLUTE_MOTION_PARAMS = new Set(["lookX", "lookY"]);

export function specParamToMotionKey(param: string): MotionStateKey | null {
  return SPEC_PARAM_TO_MOTION_KEY[param] ?? null;
}

export function specValueToMotionAbsolute(
  param: string,
  specValue: number,
  strength: number,
): { key: MotionStateKey; value: number } | null {
  const key = specParamToMotionKey(param);
  if (!key) {
    return null;
  }

  const scaled = specValue * strength;

  if (param === "eyeOpen") {
    return { key, value: Math.max(0, scaled) };
  }

  if (ABSOLUTE_MOTION_PARAMS.has(param)) {
    return { key, value: clamp01(scaled) };
  }

  const neutral = NEUTRAL_CENTERED[key] ?? 0.5;
  return { key, value: clamp01(neutral + scaled) };
}

export function applyPartialMotionAbsolute(
  base: MotionState,
  partial: Partial<MotionState>,
  activeKeys: readonly MotionStateKey[],
  customKeys: readonly string[],
): MotionState {
  const result: MotionState = {
    ...base,
    custom: { ...base.custom },
  };

  for (const key of activeKeys) {
    if (partial[key] !== undefined) {
      result[key] = partial[key]!;
    }
  }

  for (const key of customKeys) {
    if (partial.custom?.[key] !== undefined) {
      result.custom[key] = partial.custom[key]!;
    }
  }

  return result;
}
