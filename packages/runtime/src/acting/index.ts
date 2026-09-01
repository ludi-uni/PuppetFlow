export { sampleActingPrimitive } from "./primitives.js";
export { ActingEngine, type ActingEngineOptions } from "./engine.js";
export {
  blendBoneRotations,
  composeBoneRotation,
  identityPose,
  quaternionFromEuler,
} from "./rotation.js";
export { ActingScheduler, type ActingSchedulerOptions } from "./scheduler.js";
export {
  ACTING_ACTION_NAMES,
  ACTING_BLEND_DURATION_MAX_SECONDS,
  ACTING_BLEND_DURATION_MIN_SECONDS,
  ACTING_DURATION_MAX_SECONDS,
  ACTING_DURATION_MIN_SECONDS,
  ACTING_SPEED_MAX,
  ACTING_SPEED_MIN,
  DEFAULT_ACTING_BLEND_DURATION_SECONDS,
  type ActingActionName,
  type ActingActionParams,
  type ActingActionRequest,
  type ActingApi,
  type ActingBoneProfile,
  type ActingCommandResult,
  type ActingPrimitiveContext,
  type ActingSide,
  type ActingState,
  validateActingActionParams,
  validateActingDuration,
} from "./types.js";
