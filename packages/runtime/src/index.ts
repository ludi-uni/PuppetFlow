export type { MotionSource, StateSource } from "@puppetflow/source-core";
export type { MotionFrameAdapter } from "@puppetflow/adapter-core";
export type { MotionFramePipeline } from "@puppetflow/motion-pipeline";
export type {
  MotionFrameGraphDocument,
  MotionFrameGraphSnapshot,
  MotionGraphSignalValue,
} from "@puppetflow/motion-graph";
export {
  applyMotionFailSafe,
  type MotionFailSafeAction,
  type MotionFailSafeOptions,
  type MotionFailSafeResult,
} from "./motion-failsafe.js";
export type {
  BehaviorId,
  MicroBehaviorId,
  MicroBehaviorRequest,
  MicroBehaviorSnapshot,
} from "@puppetflow/micro-behavior";
export { MicroBehaviorEngine } from "@puppetflow/micro-behavior";
export {
  PuppetFlowRuntime,
  type MotionListener,
  type MotionUpdateListener,
  type PluginOutputSnapshot,
} from "./runtime.js";
export type { StatefulEntrySnapshot } from "@puppetflow/stateful-core";
export {
  calculateRateHz,
  cloneMotionMixerInspection,
  type MotionInspectorSnapshot,
  type MotionOutputInspectorSnapshot,
  type MotionSourceInspectorSnapshot,
} from "./motion-inspector.js";
export {
  ACTING_ACTION_NAMES,
  ACTING_BLEND_DURATION_MAX_SECONDS,
  ACTING_BLEND_DURATION_MIN_SECONDS,
  ACTING_DURATION_MAX_SECONDS,
  ACTING_DURATION_MIN_SECONDS,
  ACTING_SPEED_MAX,
  ACTING_SPEED_MIN,
  DEFAULT_ACTING_BLEND_DURATION_SECONDS,
  blendBoneRotations,
  composeBoneRotation,
  identityPose,
  quaternionFromEuler,
  sampleActingPrimitive,
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
} from "./acting/index.js";
