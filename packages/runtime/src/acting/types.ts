import type { Quaternion, Vec3 } from "@puppetflow/core";

export const ACTING_ACTION_NAMES = [
  "look_camera",
  "look_left",
  "look_right",
  "head_tilt",
  "nod",
  "shake_head",
  "wave",
  "small_wave",
  "bow",
  "shrug",
  "recoil",
  "idle",
  "body_lean",
] as const;

export type ActingActionName = (typeof ACTING_ACTION_NAMES)[number];

export type ActingSide = "left" | "right" | "both";

export const ACTING_DURATION_MIN_SECONDS = 0.05;
export const ACTING_DURATION_MAX_SECONDS = 30;
export const ACTING_SPEED_MIN = 0.1;
export const ACTING_SPEED_MAX = 4;
export const ACTING_BLEND_DURATION_MIN_SECONDS = 0.1;
export const ACTING_BLEND_DURATION_MAX_SECONDS = 0.3;
export const DEFAULT_ACTING_BLEND_DURATION_SECONDS = 0.18;

export interface ActingActionParams {
  intensity?: number;
  duration?: number;
  speed?: number;
  side?: ActingSide;
  blendDuration?: number;
}

export interface ActingActionRequest extends ActingActionParams {
  action: ActingActionName | string;
}

export interface ActingCommandResult {
  accepted: boolean;
  state: ActingState;
  reason?: string;
}

export interface ActingState {
  activeAction?: ActingActionRequest;
  activeActionId?: number;
  sequenceId?: number;
  elapsed: number;
  remaining: number;
  queueLength: number;
  blendRemaining: number;
}

export interface ActingBoneProfile {
  id: string;
  bones: readonly {
    name: string;
    position: Vec3;
    neutralRotation?: Quaternion;
  }[];
}

export interface ActingPrimitiveContext {
  elapsed: number;
  duration: number;
}

export interface ActingApi {
  act(
    action: ActingActionName | string,
    params?: ActingActionParams,
  ): ActingCommandResult;
  sequence(actions: readonly ActingActionRequest[]): ActingCommandResult;
  interrupt(): ActingCommandResult;
  get_state(): ActingState;
}

/** Rejects invalid explicit action parameters before they can alter acting state. */
export function validateActingActionParams(params: ActingActionParams): void {
  if (params.intensity !== undefined && !Number.isFinite(params.intensity)) {
    throw new RangeError("Acting intensity must be finite");
  }
  if (params.duration !== undefined) {
    validateRange(
      params.duration,
      ACTING_DURATION_MIN_SECONDS,
      ACTING_DURATION_MAX_SECONDS,
      "duration",
    );
  }
  if (params.speed !== undefined) {
    validateRange(params.speed, ACTING_SPEED_MIN, ACTING_SPEED_MAX, "speed");
  }
  if (params.blendDuration !== undefined) {
    validateRange(
      params.blendDuration,
      ACTING_BLEND_DURATION_MIN_SECONDS,
      ACTING_BLEND_DURATION_MAX_SECONDS,
      "blendDuration",
    );
  }
}

export function validateActingDuration(duration: number, name = "duration"): void {
  validateRange(
    duration,
    ACTING_DURATION_MIN_SECONDS,
    ACTING_DURATION_MAX_SECONDS,
    name,
  );
}

function validateRange(value: number, min: number, max: number, name: string): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Acting ${name} must be finite and within ${min}..${max}`);
  }
}
