import type { MicroBehaviorDefinition, MicroBehaviorKeyframe } from "./types.js";

export function randomInRange(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

export function applyDurationRandomization(
  definition: MicroBehaviorDefinition,
  random: () => number,
): number {
  const range = definition.durationRandom;
  if (!range) {
    return definition.duration;
  }
  return randomInRange(random, range.min, range.max);
}

export function applyKeyframeRandomization(
  definition: MicroBehaviorDefinition,
  random: () => number,
): MicroBehaviorKeyframe[] {
  const paramRandom = definition.paramRandom;
  if (!paramRandom) {
    return definition.keyframes.map((frame) => ({
      ...frame,
      params: { ...frame.params },
    }));
  }

  const scaleByParam = new Map<string, number>();

  for (const [param, range] of Object.entries(paramRandom)) {
    const peak = definition.keyframes.reduce(
      (max, frame) => Math.max(max, Math.abs(frame.params[param] ?? 0)),
      0,
    );
    if (peak <= 0) {
      continue;
    }

    const targetMagnitude = randomInRange(
      random,
      Math.min(Math.abs(range.min), Math.abs(range.max)),
      Math.max(Math.abs(range.min), Math.abs(range.max)),
    );
    scaleByParam.set(param, targetMagnitude / peak);
  }

  return definition.keyframes.map((frame) => {
    const params: Record<string, number> = { ...frame.params };
    for (const [param, value] of Object.entries(params)) {
      const scale = scaleByParam.get(param);
      if (scale !== undefined) {
        params[param] = value * scale;
      }
    }
    return { t: frame.t, params };
  });
}

export function scaleKeyframesToDuration(
  keyframes: MicroBehaviorKeyframe[],
  baseDuration: number,
  targetDuration: number,
): MicroBehaviorKeyframe[] {
  if (baseDuration <= 0 || targetDuration <= 0) {
    return keyframes;
  }

  const scale = targetDuration / baseDuration;
  return keyframes.map((frame) => ({
    t: frame.t * scale,
    params: { ...frame.params },
  }));
}
