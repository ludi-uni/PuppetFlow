import type { Quaternion } from "@puppetflow/core";

import { identityPose, quaternionFromEuler } from "./rotation.js";
import type {
  ActingActionRequest,
  ActingPrimitiveContext,
  ActingSide,
} from "./types.js";

/**
 * Samples one model-independent acting primitive as local bone rotation offsets.
 * Finite actions always return to neutral once their duration is reached.
 */
export function sampleActingPrimitive(
  request: ActingActionRequest,
  context: ActingPrimitiveContext,
  boneNames: readonly string[],
): Record<string, Quaternion> {
  const pose = identityPose(boneNames);
  const intensity = clamp(request.intensity ?? 1, 0, 1);
  if (intensity === 0) {
    return pose;
  }

  const speed = clamp(request.speed ?? 1, 0.1, 4);
  const elapsed = Math.max(0, finiteOr(context.elapsed, 0));
  const duration = context.duration;
  const isIdle = request.action === "idle";

  if (!isIdle && (!Number.isFinite(duration) || duration <= 0 || elapsed >= duration)) {
    return pose;
  }

  const phase = isIdle ? 0 : clamp(elapsed / duration, 0, 1);
  const held = easedHoldRelease(phase);
  const pulse = Math.sin(Math.PI * phase);
  const addEuler = (boneName: string, x = 0, y = 0, z = 0): void => {
    if (!(boneName in pose)) {
      return;
    }
    pose[boneName] = quaternionFromEuler({
      x: x * intensity,
      y: y * intensity,
      z: z * intensity,
    });
  };
  const addArm = (side: ActingSide, upper: number, lower: number): void => {
    for (const selectedSide of selectedSides(side)) {
      const prefix = selectedSide === "left" ? "Left" : "Right";
      const sign = selectedSide === "left" ? -1 : 1;
      addEuler(`${prefix}UpperArm`, sign * upper, 0, 0);
      addEuler(`${prefix}LowerArm`, 0, 0, sign * lower);
    }
  };

  switch (request.action) {
    case "look_camera":
      addEuler("Head", -0.12 * held, 0, 0);
      break;
    case "look_left":
      addEuler("Head", 0, 0.35 * held, 0);
      break;
    case "look_right":
      addEuler("Head", 0, -0.35 * held, 0);
      break;
    case "head_tilt": {
      const sign = request.side === "right" ? -1 : 1;
      addEuler("Head", 0, 0, sign * 0.26 * held);
      break;
    }
    case "nod":
      addEuler("Head", 0.22 * pulse * Math.sin(Math.PI * phase * speed), 0, 0);
      break;
    case "shake_head":
      addEuler("Head", 0, 0.3 * pulse * Math.sin(Math.PI * 2 * phase * speed), 0);
      break;
    case "wave":
      addArm(
        request.side ?? "right",
        0.9 * held,
        0.35 * held * Math.cos(Math.PI * 2 * phase * speed),
      );
      break;
    case "small_wave":
      addArm(
        request.side ?? "right",
        0.45 * held,
        0.18 * held * Math.cos(Math.PI * 2 * phase * speed),
      );
      break;
    case "bow":
      addEuler("Spine", 0.3 * held, 0, 0);
      addEuler("Chest", 0.18 * held, 0, 0);
      break;
    case "shrug":
      addArm(request.side ?? "both", 0.22 * held, 0);
      for (const selectedSide of selectedSides(request.side ?? "both")) {
        const prefix = selectedSide === "left" ? "Left" : "Right";
        const sign = selectedSide === "left" ? -1 : 1;
        addEuler(`${prefix}Shoulder`, 0, 0, sign * 0.22 * held);
      }
      break;
    case "recoil": {
      const recoil =
        -0.2 * pulse * Math.exp(-2 * phase) * Math.sin(Math.PI * phase * speed);
      addEuler("Chest", recoil, 0, 0);
      addEuler("Head", recoil * 0.6, 0, 0);
      break;
    }
    case "body_lean": {
      const sign = request.side === "right" ? -1 : 1;
      addEuler("Spine", 0, 0, sign * 0.24 * held);
      addEuler("Chest", 0, 0, sign * 0.16 * held);
      break;
    }
    case "idle": {
      const time = elapsed * speed;
      addEuler(
        "Head",
        0.04 * Math.sin(time * Math.PI * 0.8),
        0,
        0.03 * Math.sin(time * Math.PI * 0.5),
      );
      addEuler("Chest", 0, 0, 0.05 * Math.sin(time * Math.PI * 0.4));
      break;
    }
    default:
      break;
  }

  return pose;
}

function selectedSides(side: ActingSide): readonly ("left" | "right")[] {
  if (side === "both") {
    return ["left", "right"];
  }
  return [side];
}

function easedHoldRelease(phase: number): number {
  if (phase <= 0.2) {
    return easeInOut(phase / 0.2);
  }
  if (phase >= 0.75) {
    return easeInOut((1 - phase) / 0.25);
  }
  return 1;
}

function easeInOut(value: number): number {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
