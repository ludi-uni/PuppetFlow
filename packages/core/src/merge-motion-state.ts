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
  const result = { ...base, custom: { ...base.custom } };

  for (const key of MOTION_STATE_KEYS) {
    const values = collectValuesForKey(key, partials);
    if (values.length === 0) {
      continue;
    }

    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    result[key] = clamp01(average);
  }

  const customPartials = partials
    .map((partial) => partial.custom)
    .filter((custom): custom is Record<string, number> => custom !== undefined);

  if (customPartials.length > 0) {
    result.custom = mergeCustomRecords(result.custom, customPartials);
  }

  return result;
}

function mergeCustomRecords(
  base: Record<string, number>,
  partials: Array<Record<string, number>>,
): Record<string, number> {
  const keys = new Set<string>(Object.keys(base));
  for (const partial of partials) {
    for (const key of Object.keys(partial)) {
      keys.add(key);
    }
  }

  const result: Record<string, number> = { ...base };
  for (const key of keys) {
    const values: number[] = [];
    for (const partial of partials) {
      const value = partial[key];
      if (value !== undefined) {
        values.push(value);
      }
    }
    if (values.length === 0) {
      continue;
    }
    result[key] = clamp01(
      values.reduce((sum, value) => sum + value, 0) / values.length,
    );
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
