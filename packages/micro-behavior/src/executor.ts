import type { MotionStateKey } from "@puppetflow/core";

import { interpolateEaseInOut } from "./easing.js";
import { specParamToMotionKey, specValueToMotionAbsolute } from "./param-map.js";
import type { MicroBehaviorKeyframe } from "./types.js";

export interface SampledBehaviorMotion {
  motion: Partial<Record<MotionStateKey, number>>;
  activeKeys: MotionStateKey[];
}

function resolveKeyframeParamsAtIndex(
  sorted: MicroBehaviorKeyframe[],
  index: number,
): Record<string, number> {
  const resolved: Record<string, number> = {};

  for (let frameIndex = 0; frameIndex <= index; frameIndex++) {
    Object.assign(resolved, sorted[frameIndex]!.params);
  }

  return resolved;
}

export function sampleBehaviorAtTime(
  keyframes: MicroBehaviorKeyframe[],
  elapsed: number,
  strength: number,
): SampledBehaviorMotion {
  if (keyframes.length === 0) {
    return { motion: {}, activeKeys: [] };
  }

  const sorted = [...keyframes].sort((a, b) => a.t - b.t);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  if (elapsed <= first.t) {
    return buildMotionFromParams(resolveKeyframeParamsAtIndex(sorted, 0), strength);
  }

  if (elapsed >= last.t) {
    return buildMotionFromParams(
      resolveKeyframeParamsAtIndex(sorted, sorted.length - 1),
      strength,
    );
  }

  let leftIndex = 0;
  let rightIndex = sorted.length - 1;

  for (let index = 0; index < sorted.length - 1; index++) {
    const current = sorted[index]!;
    const next = sorted[index + 1]!;
    if (elapsed >= current.t && elapsed <= next.t) {
      leftIndex = index;
      rightIndex = index + 1;
      break;
    }
  }

  const left = sorted[leftIndex]!;
  const right = sorted[rightIndex]!;
  const span = right.t - left.t;
  const localT = span > 0 ? (elapsed - left.t) / span : 0;
  const leftParams = resolveKeyframeParamsAtIndex(sorted, leftIndex);
  const rightParams = resolveKeyframeParamsAtIndex(sorted, rightIndex);
  const paramNames = new Set([...Object.keys(leftParams), ...Object.keys(rightParams)]);
  const blendedParams: Record<string, number> = {};

  for (const param of paramNames) {
    const from = leftParams[param] ?? 0;
    const to = rightParams[param] ?? 0;
    blendedParams[param] = interpolateEaseInOut(from, to, localT);
  }

  return buildMotionFromParams(blendedParams, strength);
}

function buildMotionFromParams(
  params: Record<string, number>,
  strength: number,
): SampledBehaviorMotion {
  const motion: Partial<Record<MotionStateKey, number>> = {};
  const activeKeys: MotionStateKey[] = [];

  for (const [param, value] of Object.entries(params)) {
    const mapped = specValueToMotionAbsolute(param, value, strength);
    if (!mapped) {
      continue;
    }

    motion[mapped.key] = mapped.value;
    if (!activeKeys.includes(mapped.key)) {
      activeKeys.push(mapped.key);
    }
  }

  return { motion, activeKeys };
}

export function collectBehaviorActiveKeys(
  keyframes: MicroBehaviorKeyframe[],
): MotionStateKey[] {
  const keys = new Set<MotionStateKey>();

  for (const frame of keyframes) {
    for (const param of Object.keys(frame.params)) {
      const key = specParamToMotionKey(param);
      if (key) {
        keys.add(key);
      }
    }
  }

  return [...keys];
}
