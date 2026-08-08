import {
  cloneMotionFrame,
  type BoneTransform,
  type MotionFrame,
  type Vec3,
} from "@puppetflow/core";

import { quaternionMultiply } from "./quaternion.js";
import type { MotionRetargetBoneConfig, MotionRetargetProfile } from "./types.js";

export function applyRetarget(
  frame: MotionFrame,
  profile: MotionRetargetProfile = {},
): MotionFrame {
  const result = cloneMotionFrame(frame);
  if (!frame.bones) {
    return result;
  }

  const bones: Record<string, BoneTransform> = {};
  for (const [sourceId, transform] of Object.entries(frame.bones)) {
    const config = profile.bones?.[sourceId];
    const targetId = profile.mapping?.[sourceId] ?? sourceId;
    const retargeted = applyBoneConfig(transform, config);
    bones[targetId] = mergeBoneTransforms(bones[targetId], retargeted);
  }

  result.bones = bones;
  return result;
}

function applyBoneConfig(
  transform: BoneTransform,
  config: MotionRetargetBoneConfig | undefined,
): BoneTransform {
  if (!config) {
    return cloneBoneTransform(transform);
  }

  validateBoneConfig(config);
  const result = cloneBoneTransform(transform);
  const scale = config.scale ?? 1;

  if (result.position) {
    result.position = addVec3(scaleVec3(result.position, scale), config.positionOffset);
  } else if (config.positionOffset) {
    result.position = { ...config.positionOffset };
  }

  if (result.rotation && config.rotationOffset) {
    result.rotation = quaternionMultiply(config.rotationOffset, result.rotation);
  }

  return result;
}

function mergeBoneTransforms(
  current: BoneTransform | undefined,
  next: BoneTransform,
): BoneTransform {
  if (!current) {
    return next;
  }

  return {
    ...current,
    ...next,
    ...(current.position && !next.position ? { position: current.position } : {}),
    ...(current.rotation && !next.rotation ? { rotation: current.rotation } : {}),
    ...(current.scale && !next.scale ? { scale: current.scale } : {}),
    ...(current.confidence !== undefined && next.confidence === undefined
      ? { confidence: current.confidence }
      : {}),
  };
}

function cloneBoneTransform(transform: BoneTransform): BoneTransform {
  return {
    ...(transform.position ? { position: { ...transform.position } } : {}),
    ...(transform.rotation ? { rotation: { ...transform.rotation } } : {}),
    ...(transform.scale ? { scale: { ...transform.scale } } : {}),
    ...(transform.confidence !== undefined ? { confidence: transform.confidence } : {}),
  };
}

function scaleVec3(value: Vec3, scale: number): Vec3 {
  return { x: value.x * scale, y: value.y * scale, z: value.z * scale };
}

function addVec3(value: Vec3, offset: Vec3 | undefined): Vec3 {
  if (!offset) {
    return value;
  }
  return { x: value.x + offset.x, y: value.y + offset.y, z: value.z + offset.z };
}

function validateBoneConfig(config: MotionRetargetBoneConfig): void {
  if (config.scale !== undefined && !Number.isFinite(config.scale)) {
    throw new Error("MotionRetargetBoneConfig.scale must be finite");
  }
}
