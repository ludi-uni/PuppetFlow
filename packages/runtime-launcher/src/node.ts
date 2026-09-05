export { attachNodeAdapters } from "./attach-node-adapters.js";
export { attachSources } from "./attach-sources.js";
export { buildRuntime } from "./build-runtime.js";
export { createAvatarLipSyncSource } from "./avatar-lip-sync-source.js";
export { createPuppetFlowHost } from "./puppetflow-host.js";
export type {
  AvatarLipSyncSource,
  AvatarPollingSource,
} from "./avatar-lip-sync-source.js";
export type { PuppetFlowHost, PuppetFlowHostOptions } from "./puppetflow-host.js";
export type {
  ActingActionParams,
  ActingActionRequest,
  ActingCommandResult,
  ActingExpressionParams,
  ActingExpressionState,
  ActingSide,
  ActingState,
  PuppetFlowControl,
} from "@puppetflow/runtime";
export type {
  AdaptersLaunchConfig,
  BehaviorApiLaunchConfig,
  OscAdapterLaunchConfig,
  RuntimeLaunchConfig,
  SourceLaunchConfig,
} from "./types.js";
