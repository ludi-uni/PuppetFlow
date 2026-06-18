import type { MotionState, MotionStateKey } from "@puppetflow/core";

export const MICRO_BEHAVIOR_IDS = [
  "look_up",
  "look_left",
  "look_right",
  "head_tilt",
  "small_nod",
  "long_blink",
] as const;

export type MicroBehaviorId = (typeof MICRO_BEHAVIOR_IDS)[number];

/** Built-in or custom behavior name */
export type BehaviorId = string;

export interface MicroBehaviorRequest {
  behavior: BehaviorId;
  /** Parsed for future use; Phase 1 defaults to 1.0 */
  strength?: number;
  /** Inline definition for custom / list-external behaviors */
  definition?: MicroBehaviorDefinition;
}

export interface MicroBehaviorKeyframe {
  t: number;
  /** Spec-relative parameter names (eyeY, eyeX, eyeOpen, headTilt, facePitch, …) */
  params: Record<string, number>;
}

export interface MicroBehaviorRandomRange {
  min: number;
  max: number;
}

export interface MicroBehaviorDefinition {
  id: BehaviorId;
  duration: number;
  cooldown: number;
  keyframes: MicroBehaviorKeyframe[];
  /** Parameter name → amplitude jitter range (applied to non-zero keyframe values) */
  paramRandom?: Record<string, MicroBehaviorRandomRange>;
  durationRandom?: MicroBehaviorRandomRange;
}

export interface MicroBehaviorStatus {
  activeBehavior: BehaviorId | null;
  remaining: number;
}

export interface MicroBehaviorQueueStatus {
  queueLength: number;
}

export interface MicroBehaviorCooldownEntry {
  behavior: BehaviorId;
  remainingSeconds: number;
}

export interface MicroBehaviorSnapshot {
  status: MicroBehaviorStatus;
  queue: MicroBehaviorQueueStatus;
  cooldowns: MicroBehaviorCooldownEntry[];
}

export interface MicroBehaviorTickResult {
  motion: Partial<MotionState>;
  activeKeys: readonly MotionStateKey[];
  customKeys: readonly string[];
}

export interface MicroBehaviorEngineOptions {
  random?: () => number;
  registry?: import("./registry.js").BehaviorRegistry;
}
