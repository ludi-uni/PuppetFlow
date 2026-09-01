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
