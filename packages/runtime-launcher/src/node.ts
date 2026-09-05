export { attachNodeAdapters } from "./attach-node-adapters.js";
export { attachSources } from "./attach-sources.js";
export { buildRuntime } from "./build-runtime.js";
export { createAvatarLipSyncSource } from "./avatar-lip-sync-source.js";
export {
  DEFAULT_ACTING_BONE_PROFILE,
  DEFAULT_EXPRESSION_PROFILE,
} from "./default-acting-profiles.js";
export { createPuppetFlowHost } from "./puppetflow-host.js";
export { createSharedHostService } from "./control-http-server.js";
export type {
  AvatarLipSyncSource,
  AvatarPollingSource,
} from "./avatar-lip-sync-source.js";
export type { PuppetFlowHost, PuppetFlowHostOptions } from "./puppetflow-host.js";
export type {
  SharedHostService,
  SharedHostServiceOptions,
} from "./control-http-server.js";
export type {
  ActingActionParams,
  ActingActionRequest,
  ActingCommandResult,
  ActingExpressionParams,
  ActingExpressionState,
  ActingSide,
  ActingState,
} from "@puppetflow/runtime";
export type { PuppetFlowControl } from "@puppetflow/control";
export type {
  AdaptersLaunchConfig,
  BehaviorApiLaunchConfig,
  OscAdapterLaunchConfig,
  RuntimeLaunchConfig,
  SourceLaunchConfig,
} from "./types.js";
