import type { Quaternion } from "@puppetflow/core";

export function normalizeQuaternion(value: Quaternion): Quaternion {
  const length = Math.hypot(value.x, value.y, value.z, value.w);
  if (length === 0 || !Number.isFinite(length)) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }

  return {
    x: value.x / length,
    y: value.y / length,
    z: value.z / length,
    w: value.w / length,
  };
}

export function quaternionDot(a: Quaternion, b: Quaternion): number {
  return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
}

export function quaternionMultiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

export function quaternionNlerp(
  from: Quaternion,
  to: Quaternion,
  weight: number,
): Quaternion {
  const start = normalizeQuaternion(from);
  const normalizedTo = normalizeQuaternion(to);
  const end =
    quaternionDot(start, normalizedTo) < 0
      ? negateQuaternion(normalizedTo)
      : normalizedTo;
  const t = Math.min(1, Math.max(0, weight));

  return normalizeQuaternion({
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    z: start.z + (end.z - start.z) * t,
    w: start.w + (end.w - start.w) * t,
  });
}

export function negateQuaternion(value: Quaternion): Quaternion {
  return { x: -value.x, y: -value.y, z: -value.z, w: -value.w };
}
