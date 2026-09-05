import { LoggerAdapter } from "@puppetflow/adapter-logger";
import { TauriOscAdapter } from "@puppetflow/adapter-vmc";
import {
  createPuppetFlowControl,
  type ActRequest,
  type ClearExpressionRequest,
  type ControlResult,
  type PuppetFlowCapabilities,
  type PuppetFlowControl,
  type PuppetFlowControlState,
  type SequenceRequest,
  type SetExpressionRequest,
} from "@puppetflow/control";
import type { MotionState, StateValue } from "@puppetflow/core";
import type { MicroBehaviorSnapshot } from "@puppetflow/micro-behavior";
import { loadPreset } from "@puppetflow/preset";
import {
  ActingEngine,
  PuppetFlowRuntime,
  type PluginOutputSnapshot,
  type StatefulEntrySnapshot,
} from "@puppetflow/runtime";
import { attachSources, type SourceLaunchConfig } from "@puppetflow/runtime-launcher";
import curiousPreset from "@puppetflow/behavior-packs/presets/Curious.pfpreset?raw";
import focusedPreset from "@puppetflow/behavior-packs/presets/Focused.pfpreset?raw";
import happyPreset from "@puppetflow/behavior-packs/presets/Happy.pfpreset?raw";
import idlePreset from "@puppetflow/behavior-packs/presets/Idle.pfpreset?raw";
import sleepyPreset from "@puppetflow/behavior-packs/presets/Sleepy.pfpreset?raw";
import thinkingPreset from "@puppetflow/behavior-packs/presets/Thinking.pfpreset?raw";
import {
  cloneMapperConfig,
  DEFAULT_MAPPER_CONFIG,
  getMapperTargets,
  toMotionMapperProfile,
  type MotionMapperEditorConfig,
} from "./mapper-config";
import {
  loadPersistedMapperConfig,
  loadPersistedSourceConfig,
} from "./utils/studio-config-storage";
import { DEFAULT_ACTING_BONE_PROFILE } from "./acting/default-acting-profile";
import { DEFAULT_EXPRESSION_PROFILE } from "./acting/default-expression-profile";

const PRESETS = {
  Curious: curiousPreset,
  Happy: happyPreset,
  Idle: idlePreset,
  Thinking: thinkingPreset,
  Sleepy: sleepyPreset,
  Focused: focusedPreset,
} as const;

export type PresetName = keyof typeof PRESETS;

export type SourceConfig = SourceLaunchConfig;

class StaleRuntimeStartup extends Error {
  override readonly name = "StaleRuntimeStartup";
}

let runtime: PuppetFlowRuntime | null = null;
let actingConnection: StudioActingConnection | null = null;
let startupGeneration = 0;
let startupPromise: Promise<PuppetFlowRuntime> | null = null;
let shuttingDown = false;
let currentPreset: PresetName = "Curious";
let customPresetJson: string | null = null;
let sourceConfig: SourceConfig = {
  httpUrl: null,
  wsUrl: null,
  mqttBroker: null,
  mqttTopic: null,
};
let mapperConfig: MotionMapperEditorConfig = cloneMapperConfig(DEFAULT_MAPPER_CONFIG);

const persistedMapper = loadPersistedMapperConfig();
if (persistedMapper) {
  mapperConfig = persistedMapper;
}

const persistedSources = loadPersistedSourceConfig();
if (persistedSources) {
  sourceConfig = { ...persistedSources };
}

const pipelineListenerSet = new Set<(update: MotionPipelineUpdate) => void>();
const pipelineListenerUnsubs = new Map<
  (update: MotionPipelineUpdate) => void,
  () => void
>();
export interface StudioActingSnapshot {
  state: PuppetFlowControlState;
  capabilities: PuppetFlowCapabilities;
  ready: boolean;
}

type StudioActingListener = (snapshot: StudioActingSnapshot) => void;

interface StudioActingConnection {
  runtime: PuppetFlowRuntime;
  control: PuppetFlowControl;
  capabilities: PuppetFlowCapabilities;
}

const actingListenerSet = new Set<StudioActingListener>();
const actingListenerUnsubs = new Map<StudioActingListener, () => void>();

function isTauriEnvironment(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    Boolean((globalThis as { isTauri?: boolean }).isTauri)
  );
}

export function attachMapperOutputs(
  instance: PuppetFlowRuntime,
  config: MotionMapperEditorConfig = mapperConfig,
  tauriEnvironment = isTauriEnvironment(),
): void {
  if (!tauriEnvironment) {
    return;
  }

  for (const target of getMapperTargets()) {
    const model = config[target];
    if (!model.enabled) {
      continue;
    }

    const adapter = new TauriOscAdapter({
      id: `osc-${target}`,
      host: model.host,
      port: model.port,
      profile: toMotionMapperProfile(target, model),
      customParams: model.customParams,
      customTransforms: model.customTransforms,
    });
    instance.attachAdapter(adapter);
    if (target === "vmc") {
      instance.attachMotionAdapter(adapter);
    }
  }
}

function buildRuntime(): PuppetFlowRuntime {
  const presetJson = customPresetJson ?? PRESETS[currentPreset];
  const loaded = loadPreset(presetJson);
  const instance = new PuppetFlowRuntime().loadPreset(loaded).attachActingEngine(
    new ActingEngine({
      profile: DEFAULT_ACTING_BONE_PROFILE,
      expressionProfile: DEFAULT_EXPRESSION_PROFILE,
      autoIdle: true,
    }),
  );

  attachMapperOutputs(instance);

  if (mapperConfig.loggerEnabled) {
    instance.attachAdapter(
      new LoggerAdapter({
        label: "Studio",
        throttleMs: mapperConfig.loggerThrottleMs,
      }),
    );
  }

  attachSources(instance, sourceConfig);

  return instance;
}

function bindPipelineListeners(instance: PuppetFlowRuntime): void {
  for (const unsub of pipelineListenerUnsubs.values()) {
    unsub();
  }
  pipelineListenerUnsubs.clear();

  for (const listener of pipelineListenerSet) {
    pipelineListenerUnsubs.set(listener, instance.onMotionPipelineUpdate(listener));
  }
}

function actingSnapshot(
  connection: StudioActingConnection,
  ready: boolean,
): StudioActingSnapshot {
  return {
    state: connection.control.getState(),
    capabilities: connection.capabilities,
    ready,
  };
}

function publishActingSnapshot(
  connection: StudioActingConnection,
  ready: boolean,
): void {
  const snapshot = actingSnapshot(connection, ready);
  for (const listener of actingListenerSet) listener(snapshot);
}

function bindActingListener(
  listener: StudioActingListener,
  connection: StudioActingConnection,
): void {
  const unsubscribe = connection.runtime.onActingUpdate(() => {
    if (
      !actingListenerSet.has(listener) ||
      actingConnection !== connection ||
      !connection.runtime.isRunning()
    ) {
      return;
    }
    listener(actingSnapshot(connection, true));
  });
  actingListenerUnsubs.set(listener, unsubscribe);
  listener(actingSnapshot(connection, connection.runtime.isRunning()));
}

function detachActingListeners(): void {
  for (const unsub of actingListenerUnsubs.values()) {
    unsub();
  }
  actingListenerUnsubs.clear();
}

function bindActingListeners(connection: StudioActingConnection): void {
  detachActingListeners();

  for (const listener of actingListenerSet) {
    bindActingListener(listener, connection);
  }
}

function restoreState(
  instance: PuppetFlowRuntime,
  savedState: Record<string, StateValue>,
): void {
  for (const [key, value] of Object.entries(savedState)) {
    instance.state.set(key, value);
  }
}

async function createAndStartRuntime(generation: number): Promise<PuppetFlowRuntime> {
  const instance = buildRuntime();
  const control = createPuppetFlowControl(instance);
  const connection: StudioActingConnection = {
    runtime: instance,
    control,
    capabilities: control.getCapabilities(),
  };
  await instance.start();

  if (generation !== startupGeneration) {
    await instance.stop();
    throw new StaleRuntimeStartup();
  }

  runtime = instance;
  actingConnection = connection;
  bindPipelineListeners(instance);
  bindActingListeners(connection);
  return instance;
}

export function getRuntime(): PuppetFlowRuntime {
  if (!runtime) {
    throw new Error("Runtime is not ready yet. Call ensureRuntime() first.");
  }

  return runtime;
}

export async function restartRuntime(): Promise<PuppetFlowRuntime> {
  startupGeneration++;

  let savedState: Record<string, StateValue> = {};
  if (runtime) {
    const instance = runtime;
    const connection = actingConnection;
    savedState = instance.state.getAll();
    const stopping = instance.stop();
    if (connection?.runtime === instance) {
      publishActingSnapshot(connection, false);
    }
    detachActingListeners();
    await stopping;
    runtime = null;
  }

  startupPromise = null;
  try {
    const instance = await ensureRuntime();
    restoreState(instance, savedState);
    return instance;
  } catch (error) {
    actingConnection = null;
    throw error;
  }
}

export async function shutdownRuntime(): Promise<void> {
  shuttingDown = true;
  startupGeneration++;
  startupPromise = null;

  if (!runtime) {
    detachActingListeners();
    actingConnection = null;
    return;
  }

  const instance = runtime;
  const connection = actingConnection;
  const stopping = instance.stop();
  if (connection?.runtime === instance) {
    publishActingSnapshot(connection, false);
  }
  detachActingListeners();
  runtime = null;
  actingConnection = null;
  await stopping;
}

export async function ensureRuntime(): Promise<PuppetFlowRuntime> {
  if (shuttingDown) {
    throw new Error("Runtime is shutting down");
  }

  if (runtime) {
    return runtime;
  }

  const generation = startupGeneration;

  if (!startupPromise) {
    startupPromise = createAndStartRuntime(generation).finally(() => {
      startupPromise = null;
    });
  }

  try {
    return await startupPromise;
  } catch (error) {
    if (error instanceof StaleRuntimeStartup) {
      if (shuttingDown) {
        throw new Error("Runtime is shutting down");
      }
      return ensureRuntime();
    }

    throw error;
  }
}

export async function switchPreset(presetName: PresetName): Promise<PuppetFlowRuntime> {
  currentPreset = presetName;
  customPresetJson = null;
  return restartRuntime();
}

export async function loadCustomPreset(json: string): Promise<PuppetFlowRuntime> {
  customPresetJson = json;
  return restartRuntime();
}

export function getCurrentPreset(): PresetName {
  return currentPreset;
}

export function isCustomPresetActive(): boolean {
  return customPresetJson !== null;
}

export function getPresetJson(presetName: PresetName): string {
  return PRESETS[presetName];
}

export function getActivePluginIds(): string[] {
  if (!runtime) {
    return getPresetPluginIds(currentPreset);
  }

  return runtime.getPlugins().map((plugin) => plugin.id);
}

export function getPresetPluginIds(presetName: PresetName): string[] {
  const loaded = loadPreset(customPresetJson ?? PRESETS[presetName]);
  const ids = loaded.plugins.map((plugin) => plugin.id);
  return ids;
}

export async function setSourceConfig(
  config: SourceConfig,
): Promise<PuppetFlowRuntime> {
  sourceConfig = config;
  return restartRuntime();
}

export function getSourceConfig(): SourceConfig {
  return { ...sourceConfig };
}

export async function setMapperConfig(
  config: MotionMapperEditorConfig,
): Promise<PuppetFlowRuntime> {
  mapperConfig = cloneMapperConfig(config);
  return restartRuntime();
}

export function getMapperConfig(): MotionMapperEditorConfig {
  return cloneMapperConfig(mapperConfig);
}

export function getActivePipelineStageIds(): string[] {
  if (!runtime) {
    return getPresetPluginIds(currentPreset);
  }

  const pluginIds = runtime.getPlugins().map((plugin) => plugin.id);
  return [...pluginIds, "behavior", "graph"];
}

export function getPresetBehaviorPluginIds(presetName: PresetName): string[] {
  const loaded = loadPreset(customPresetJson ?? PRESETS[presetName]);
  return loaded.behaviorPlugins.map((plugin) => plugin.id);
}

export function getBehaviorPluginIdsFromPresetJson(json: string): string[] {
  const loaded = loadPreset(json);
  return loaded.behaviorPlugins.map((plugin) => plugin.id);
}

export type MotionPipelineUpdate = {
  target: MotionState;
  rendered: MotionState;
  pluginOutputs: PluginOutputSnapshot[];
  channels: Record<string, string | number | boolean>;
  activeTimelineEvents: Array<{
    startMs: number;
    endMs: number;
    type: string;
    value: unknown;
  }>;
  timelineCurrentMs: number;
  statefulSnapshot: StatefulEntrySnapshot[];
  microBehavior: MicroBehaviorSnapshot;
};

export function subscribeMotionPipeline(
  listener: (update: MotionPipelineUpdate) => void,
): () => void {
  pipelineListenerSet.add(listener);

  if (runtime) {
    pipelineListenerUnsubs.set(listener, runtime.onMotionPipelineUpdate(listener));
  } else {
    void ensureRuntime().then(() => {
      if (pipelineListenerSet.has(listener) && runtime) {
        pipelineListenerUnsubs.set(listener, runtime.onMotionPipelineUpdate(listener));
      }
    });
  }

  return () => {
    pipelineListenerSet.delete(listener);
    pipelineListenerUnsubs.get(listener)?.();
    pipelineListenerUnsubs.delete(listener);
  };
}

function getActingControl(): PuppetFlowControl {
  if (!actingConnection) {
    throw new Error("Studio acting control is not ready");
  }
  return actingConnection.control;
}

export function act(request: ActRequest): ControlResult {
  return getActingControl().act(request);
}

export function sequence(request: SequenceRequest): ControlResult {
  return getActingControl().sequence(request);
}

export function interrupt(): ControlResult {
  return getActingControl().interrupt();
}

export function setExpression(request: SetExpressionRequest): ControlResult {
  return getActingControl().setExpression(request);
}

export function clearExpression(request?: ClearExpressionRequest): ControlResult {
  return getActingControl().clearExpression(request);
}

export function getActingState(): PuppetFlowControlState {
  return getActingControl().getState();
}

export function getActingCapabilities(): PuppetFlowCapabilities {
  return getActingControl().getCapabilities();
}

export function subscribeActing(listener: StudioActingListener): () => void {
  actingListenerSet.add(listener);

  if (actingConnection && runtime === actingConnection.runtime) {
    bindActingListener(listener, actingConnection);
  } else {
    void ensureRuntime().then(() => {
      if (
        actingListenerSet.has(listener) &&
        actingConnection &&
        runtime === actingConnection.runtime &&
        !actingListenerUnsubs.has(listener)
      ) {
        bindActingListener(listener, actingConnection);
      }
    });
  }

  return () => {
    actingListenerSet.delete(listener);
    actingListenerUnsubs.get(listener)?.();
    actingListenerUnsubs.delete(listener);
  };
}
