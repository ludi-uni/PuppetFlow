import {
  clamp01,
  DEFAULT_MOTION_STATE,
  MOTION_STATE_KEYS,
  type MotionState,
  type MotionStateKey,
} from "./motion-state.js";

export function mergeMotionState(
  base: MotionState,
  partials: Partial<MotionState>[],
): MotionState {
  const result = { ...base };

  for (const key of MOTION_STATE_KEYS) {
    const values = collectValuesForKey(key, partials);
    if (values.length === 0) {
      continue;
    }

    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    result[key] = clamp01(average);
  }

  return result;
}

export function createEmptyMotionState(): MotionState {
  return { ...DEFAULT_MOTION_STATE };
}

function collectValuesForKey(
  key: MotionStateKey,
  partials: Partial<MotionState>[],
): number[] {
  const values: number[] = [];

  for (const partial of partials) {
    const value = partial[key];
    if (value !== undefined) {
      values.push(value);
    }
  }

  return values;
}
