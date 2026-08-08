import {
  cloneMotionFrame,
  type BoneTransform,
  type MotionFrame,
  type Vec3,
} from "@puppetflow/core";
import { quaternionNlerp } from "@puppetflow/motion-pipeline";

export type MotionFailSafeAction =
  | "hold-last-frame"
  | "blend-to-neutral"
  | "disable-source";

export interface MotionFailSafeOptions {
  timeoutMs: number;
  action: MotionFailSafeAction;
  transitionMs?: number;
}

export interface MotionFailSafeResult {
  stale: boolean;
  frame: MotionFrame | undefined;
}

export function applyMotionFailSafe(
  frame: MotionFrame,
  ageMs: number,
  options: MotionFailSafeOptions,
): MotionFailSafeResult {
  validateOptions(options);
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    throw new Error("MotionFailSafe ageMs must be non-negative and finite");
  }

  if (ageMs < options.timeoutMs) {
    return { stale: false, frame: cloneMotionFrame(frame) };
  }

  if (options.action === "hold-last-frame") {
    return { stale: true, frame: cloneMotionFrame(frame) };
  }

  if (options.action === "disable-source") {
    return { stale: true, frame: undefined };
  }

  const transitionMs = options.transitionMs ?? 0;
  const factor =
    transitionMs === 0
      ? 0
      : Math.min(1, Math.max(0, 1 - (ageMs - options.timeoutMs) / transitionMs));
  return { stale: true, frame: blendToNeutral(frame, factor) };
}

function blendToNeutral(frame: MotionFrame, factor: number): MotionFrame {
  const result = cloneMotionFrame(frame);
  if (result.blendShapes) {
    result.blendShapes = Object.fromEntries(
      Object.entries(result.blendShapes).map(([key, value]) => [
        key,
        factor === 0 ? 0 : value * factor,
      ]),
    );
  }
  if (result.parameters) {
    result.parameters = Object.fromEntries(
      Object.entries(result.parameters).map(([key, value]) => [
        key,
        factor === 0 ? 0 : value * factor,
      ]),
    );
  }
  if (result.bones) {
    result.bones = Object.fromEntries(
      Object.entries(result.bones).map(([boneId, transform]) => [
        boneId,
        blendBoneToNeutral(transform, factor),
      ]),
    );
  }
  return result;
}

function blendBoneToNeutral(transform: BoneTransform, factor: number): BoneTransform {
  return {
    ...transform,
    ...(transform.position
      ? { position: blendVec3ToNeutral(transform.position, factor) }
      : {}),
    ...(transform.rotation
      ? {
          rotation: quaternionNlerp(
            { x: 0, y: 0, z: 0, w: 1 },
            transform.rotation,
            factor,
          ),
        }
      : {}),
    ...(transform.scale ? { scale: blendScaleToNeutral(transform.scale, factor) } : {}),
  };
}

function blendVec3ToNeutral(value: Vec3, factor: number): Vec3 {
  if (factor === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  return { x: value.x * factor, y: value.y * factor, z: value.z * factor };
}

function blendScaleToNeutral(value: Vec3, factor: number): Vec3 {
  return {
    x: 1 + (value.x - 1) * factor,
    y: 1 + (value.y - 1) * factor,
    z: 1 + (value.z - 1) * factor,
  };
}

function validateOptions(options: MotionFailSafeOptions): void {
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 0) {
    throw new Error("MotionFailSafe timeoutMs must be non-negative and finite");
  }
  if (
    options.transitionMs !== undefined &&
    (!Number.isFinite(options.transitionMs) || options.transitionMs < 0)
  ) {
    throw new Error("MotionFailSafe transitionMs must be non-negative and finite");
  }
}
