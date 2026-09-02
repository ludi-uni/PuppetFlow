export { sampleActingPrimitive } from "./primitives.js";
export { ActingEngine, type ActingEngineOptions } from "./engine.js";
export { ExpressionEngine, type ExpressionEngineOptions } from "./expression-engine.js";
export {
  blendBoneRotations,
  composeBoneRotation,
  identityPose,
  quaternionFromEuler,
} from "./rotation.js";
export { ActingScheduler, type ActingSchedulerOptions } from "./scheduler.js";
export {
  expressionProfileChannels,
  resolveExpressionTarget,
  validateActingExpressionParams,
  validateActingExpressionProfile,
} from "./expression-profile.js";
export {
  ACTING_ACTION_NAMES,
  ACTING_BLEND_DURATION_MAX_SECONDS,
  ACTING_BLEND_DURATION_MIN_SECONDS,
  ACTING_DURATION_MAX_SECONDS,
  ACTING_DURATION_MIN_SECONDS,
  ACTING_EXPRESSION_NAMES,
  ACTING_SPEED_MAX,
  ACTING_SPEED_MIN,
  DEFAULT_ACTING_BLEND_DURATION_SECONDS,
  type ActingActionName,
  type ActingActionParams,
  type ActingActionRequest,
  type ActingApi,
  type ActingBoneProfile,
  type ActingCommandResult,
  type ActingExpressionName,
  type ActingExpressionParams,
  type ActingExpressionProfile,
  type ActingExpressionRequest,
  type ActingExpressionState,
  type ActingExpressionTarget,
  type ActingRuntimeApi,
  type ExpressionApi,
  type ExpressionCommandResult,
  type ActingPrimitiveContext,
  type ActingSide,
  type ActingState,
  validateActingActionParams,
  validateActingDuration,
} from "./types.js";
