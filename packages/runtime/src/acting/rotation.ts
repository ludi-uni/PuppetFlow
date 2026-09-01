import type { Quaternion, Vec3 } from "@puppetflow/core";
import {
  normalizeQuaternion,
  quaternionMultiply,
  quaternionNlerp,
} from "@puppetflow/motion-pipeline";

const IDENTITY_ROTATION: Quaternion = { x: 0, y: 0, z: 0, w: 1 };

/** Converts an intrinsic XYZ Euler offset in radians into a normalized quaternion. */
export function quaternionFromEuler(euler: Vec3): Quaternion {
  const halfX = euler.x / 2;
  const halfY = euler.y / 2;
  const halfZ = euler.z / 2;
  const sinX = Math.sin(halfX);
  const cosX = Math.cos(halfX);
  const sinY = Math.sin(halfY);
  const cosY = Math.cos(halfY);
  const sinZ = Math.sin(halfZ);
  const cosZ = Math.cos(halfZ);

  return normalizeQuaternion({
    x: sinX * cosY * cosZ + cosX * sinY * sinZ,
    y: cosX * sinY * cosZ - sinX * cosY * sinZ,
    z: cosX * cosY * sinZ + sinX * sinY * cosZ,
    w: cosX * cosY * cosZ - sinX * sinY * sinZ,
  });
}

/** Applies a local acting offset to a neutral or already-rendered bone rotation. */
export function composeBoneRotation(base: Quaternion, offset: Quaternion): Quaternion {
  return normalizeQuaternion(
    quaternionMultiply(normalizeQuaternion(base), normalizeQuaternion(offset)),
  );
}

/** Hemisphere-safe normalized interpolation for every named bone. */
export function blendBoneRotations(
  from: Readonly<Record<string, Quaternion>>,
  to: Readonly<Record<string, Quaternion>>,
  boneNames: readonly string[],
  weight: number,
): Record<string, Quaternion> {
  return Object.fromEntries(
    boneNames.map((boneName) => [
      boneName,
      quaternionNlerp(
        from[boneName] ?? IDENTITY_ROTATION,
        to[boneName] ?? IDENTITY_ROTATION,
        weight,
      ),
    ]),
  );
}

/** Creates a complete neutral local-offset pose for the supplied profile bones. */
export function identityPose(boneNames: readonly string[]): Record<string, Quaternion> {
  return Object.fromEntries(
    boneNames.map((boneName) => [boneName, { ...IDENTITY_ROTATION }]),
  );
}
