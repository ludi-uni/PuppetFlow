import {
  cloneMotionFrame,
  type BoneId,
  type BoneTransform,
  type Quaternion,
  type Vec3,
} from "@puppetflow/core";

import { quaternionNlerp } from "./quaternion.js";
import type { MotionFrameFilter } from "./types.js";

export interface MotionFilterScope {
  bones?: readonly BoneId[];
  blendShapes?: readonly string[];
  parameters?: readonly string[];
}

export type MotionFilterPipeline = MotionFrameFilter;

type FilterState = number | Vec3 | Quaternion;

export function createDeadzoneFilter(
  options: MotionFilterScope & { deadzone: number; id?: string },
): MotionFrameFilter {
  validateNonNegative(options.deadzone, "deadzone");
  return {
    id: options.id ?? "deadzone",
    apply(frame, _deltaTime) {
      const result = cloneMotionFrame(frame);
      result.blendShapes = mapNumericDomain(
        result.blendShapes,
        options.blendShapes,
        (value) => (Math.abs(value) <= options.deadzone ? 0 : value),
      );
      result.parameters = mapNumericDomain(
        result.parameters,
        options.parameters,
        (value) => (Math.abs(value) <= options.deadzone ? 0 : value),
      );
      return result;
    },
    reset() {},
  };
}

export function createClampFilter(
  options: MotionFilterScope & { min: number; max: number; id?: string },
): MotionFrameFilter {
  if (!Number.isFinite(options.min) || !Number.isFinite(options.max)) {
    throw new Error("clamp min and max must be finite");
  }
  if (options.min > options.max) {
    throw new Error("clamp min must not exceed max");
  }

  return {
    id: options.id ?? "clamp",
    apply(frame, _deltaTime) {
      const result = cloneMotionFrame(frame);
      const clamp = (value: number) =>
        Math.min(options.max, Math.max(options.min, value));
      result.blendShapes = mapNumericDomain(
        result.blendShapes,
        options.blendShapes,
        clamp,
      );
      result.parameters = mapNumericDomain(
        result.parameters,
        options.parameters,
        clamp,
      );
      return result;
    },
    reset() {},
  };
}

export function createLowPassFilter(
  options: MotionFilterScope & { alpha: number; id?: string },
): MotionFrameFilter {
  if (!Number.isFinite(options.alpha) || options.alpha < 0 || options.alpha > 1) {
    throw new Error("low-pass alpha must be between 0 and 1");
  }

  const state = new Map<string, FilterState>();
  return {
    id: options.id ?? "low-pass",
    apply(frame, _deltaTime) {
      const result = cloneMotionFrame(frame);
      result.blendShapes = smoothNumericDomain(
        result.blendShapes,
        options.blendShapes,
        state,
        "blendShape",
        options.alpha,
      );
      result.parameters = smoothNumericDomain(
        result.parameters,
        options.parameters,
        state,
        "parameter",
        options.alpha,
      );
      result.bones = smoothBones(result.bones, options.bones, state, options.alpha);
      return result;
    },
    reset() {
      state.clear();
    },
  };
}

export function createMotionFilterPipeline(
  filters: readonly MotionFrameFilter[],
): MotionFilterPipeline {
  return {
    id: "filter-pipeline",
    apply(frame, deltaTime) {
      return filters.reduce(
        (current, filter) => filter.apply(current, deltaTime),
        cloneMotionFrame(frame),
      );
    },
    reset() {
      for (const filter of filters) {
        filter.reset();
      }
    },
  };
}

function mapNumericDomain(
  values: Record<string, number> | undefined,
  mask: readonly string[] | undefined,
  map: (value: number) => number,
): Record<string, number> | undefined {
  if (!values) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      isSelected(mask, key) ? map(value) : value,
    ]),
  );
}

function smoothNumericDomain(
  values: Record<string, number> | undefined,
  mask: readonly string[] | undefined,
  state: Map<string, FilterState>,
  domain: string,
  alpha: number,
): Record<string, number> | undefined {
  if (!values) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => {
      if (!isSelected(mask, key)) {
        return [key, value];
      }
      return [key, smoothNumber(`${domain}:${key}`, value, state, alpha)];
    }),
  );
}

function smoothBones(
  bones: Record<string, BoneTransform> | undefined,
  mask: readonly BoneId[] | undefined,
  state: Map<string, FilterState>,
  alpha: number,
): Record<string, BoneTransform> | undefined {
  if (!bones) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(bones).map(([boneId, transform]) => {
      if (!isSelected(mask, boneId)) {
        return [boneId, transform];
      }

      return [
        boneId,
        {
          ...transform,
          ...(transform.position
            ? {
                position: smoothVec3(
                  `bone:${boneId}:position`,
                  transform.position,
                  state,
                  alpha,
                ),
              }
            : {}),
          ...(transform.rotation
            ? {
                rotation: smoothQuaternion(
                  `bone:${boneId}:rotation`,
                  transform.rotation,
                  state,
                  alpha,
                ),
              }
            : {}),
          ...(transform.scale
            ? {
                scale: smoothVec3(
                  `bone:${boneId}:scale`,
                  transform.scale,
                  state,
                  alpha,
                ),
              }
            : {}),
        },
      ];
    }),
  );
}

function smoothNumber(
  key: string,
  value: number,
  state: Map<string, FilterState>,
  alpha: number,
): number {
  const previous = state.get(key);
  if (typeof previous !== "number") {
    state.set(key, value);
    return value;
  }
  const result = previous + (value - previous) * alpha;
  state.set(key, result);
  return result;
}

function smoothVec3(
  key: string,
  value: Vec3,
  state: Map<string, FilterState>,
  alpha: number,
): Vec3 {
  const previous = state.get(key);
  if (!isVec3(previous)) {
    const result = { ...value };
    state.set(key, result);
    return result;
  }

  const result = {
    x: previous.x + (value.x - previous.x) * alpha,
    y: previous.y + (value.y - previous.y) * alpha,
    z: previous.z + (value.z - previous.z) * alpha,
  };
  state.set(key, result);
  return result;
}

function smoothQuaternion(
  key: string,
  value: Quaternion,
  state: Map<string, FilterState>,
  alpha: number,
): Quaternion {
  const previous = state.get(key);
  if (!isQuaternion(previous)) {
    const result = { ...value };
    state.set(key, result);
    return result;
  }

  const result = quaternionNlerp(previous, value, alpha);
  state.set(key, result);
  return result;
}

function isSelected(mask: readonly string[] | undefined, key: string): boolean {
  return mask === undefined || mask.includes(key);
}

function isVec3(value: FilterState | undefined): value is Vec3 {
  return (
    value !== undefined &&
    typeof value === "object" &&
    "x" in value &&
    "y" in value &&
    "z" in value &&
    !("w" in value)
  );
}

function isQuaternion(value: FilterState | undefined): value is Quaternion {
  return (
    value !== undefined &&
    typeof value === "object" &&
    "x" in value &&
    "y" in value &&
    "z" in value &&
    "w" in value
  );
}

function validateNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number`);
  }
}
