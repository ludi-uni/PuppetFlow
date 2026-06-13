import {
  LEGACY_MOTION_KEY_REPLACEMENTS,
  MOTION_STATE_KEYS,
  type MotionStateKey,
} from "@puppetflow/core";

/** PFScript motion names → standard MotionState keys. Unlisted names use `custom`. */
export const PFSCRIPT_MOTION_ALIASES: Readonly<Record<string, MotionStateKey>> = {
  smile: "mouthX",
  mouthOpen: "mouthY",
  eyeOpen: "eyeYaw",
  eyeSmile: "eyePitch",
  ...LEGACY_MOTION_KEY_REPLACEMENTS,
};

export function isStandardMotionKey(name: string): name is MotionStateKey {
  return (MOTION_STATE_KEYS as readonly string[]).includes(name);
}

export function resolveMotionAlias(name: string): MotionStateKey | undefined {
  if (isStandardMotionKey(name)) {
    return name;
  }
  return PFSCRIPT_MOTION_ALIASES[name];
}

export function resolveAssignTarget(name: string): MotionStateKey | { custom: string } {
  const motionKey = resolveMotionAlias(name);
  if (motionKey) {
    return motionKey;
  }
  return { custom: name };
}

export function formatAssignTarget(name: string): string {
  const resolved = resolveAssignTarget(name);
  if (typeof resolved === "string") {
    return resolved;
  }
  return `custom:${resolved.custom}`;
}

export function parseAssignTarget(target: string): MotionStateKey | { custom: string } {
  if (target.startsWith("custom:")) {
    return { custom: target.slice("custom:".length) };
  }
  if (isStandardMotionKey(target)) {
    return target;
  }
  return { custom: target };
}
