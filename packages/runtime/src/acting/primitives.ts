import type { Quaternion } from "@puppetflow/core";

import { identityPose, quaternionFromEuler } from "./rotation.js";
import type {
  ActingActionRequest,
  ActingPrimitiveContext,
  ActingSide,
} from "./types.js";
import { validateActingActionParams, validateActingDuration } from "./types.js";

/**
 * Samples one model-independent acting primitive as local bone rotation offsets.
 * Finite actions always return to neutral once their duration is reached.
 */
export function sampleActingPrimitive(
  request: ActingActionRequest,
  context: ActingPrimitiveContext,
  boneNames: readonly string[],
): Record<string, Quaternion> {
  validateActingActionParams(request);
  const pose = identityPose(boneNames);
  const intensity = clamp(request.intensity ?? 1, 0, 1);
  if (intensity === 0) {
    return pose;
  }

  if (!Number.isFinite(context.elapsed) || context.elapsed < 0) {
    throw new RangeError("Acting context.elapsed must be finite and non-negative");
  }

  const speed = request.speed ?? 1;
  const elapsed = context.elapsed;
  const isContinuousIdle = request.action === "idle" && request.duration === undefined;
  const duration = resolveDuration(request, context, isContinuousIdle);

  if (!isContinuousIdle && elapsed >= duration) {
    return pose;
  }

  const phase = isContinuousIdle ? 0 : elapsed / duration;
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
      addEuler(`${prefix}UpperArm`, 0, 0, sign * upper);
      addEuler(`${prefix}LowerArm`, 0, 0, sign * lower);
    }
  };

  switch (request.action) {
    case "look_camera":
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
      addEuler("Head", 0, 0.3 * held * Math.sin(Math.PI * 2 * phase * speed), 0);
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
      const envelope = isContinuousIdle ? 1 : pulse;
      addEuler(
        "Head",
        envelope * 0.04 * Math.sin(time * Math.PI * 0.8),
        0,
        envelope * 0.03 * Math.sin(time * Math.PI * 0.5),
      );
      addEuler("Chest", 0, 0, envelope * 0.05 * Math.sin(time * Math.PI * 0.4));
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

function resolveDuration(
  request: ActingActionRequest,
  context: ActingPrimitiveContext,
  isContinuousIdle: boolean,
): number {
  if (isContinuousIdle) {
    if (context.duration !== Infinity) {
      throw new RangeError(
        "Acting context.duration must be Infinity for idle without duration",
      );
    }
    return Infinity;
  }

  validateActingDuration(context.duration, "context.duration");
  if (request.duration !== undefined && context.duration !== request.duration) {
    throw new RangeError("Acting context.duration must match request.duration");
  }
  return context.duration;
}
