import { LoggerAdapter } from "@puppetflow/adapter-logger";
import { TauriOscAdapter } from "@puppetflow/adapter-vmc";
import type { MotionState, StateValue } from "@puppetflow/core";
import { loadPreset } from "@puppetflow/preset";
import {
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
let startupGeneration = 0;
let startupPromise: Promise<PuppetFlowRuntime> | null = null;
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

function isTauriEnvironment(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    Boolean((globalThis as { isTauri?: boolean }).isTauri)
  );
}

function attachMapperOutputs(instance: PuppetFlowRuntime): void {
  if (!isTauriEnvironment()) {
    return;
  }

  for (const target of getMapperTargets()) {
    const model = mapperConfig[target];
    if (!model.enabled) {
      continue;
    }

    instance.attachAdapter(
      new TauriOscAdapter({
        id: `osc-${target}`,
        host: model.host,
        port: model.port,
        profile: toMotionMapperProfile(target, model),
        customParams: model.customParams,
        customTransforms: model.customTransforms,
      }),
    );
  }
}

function buildRuntime(): PuppetFlowRuntime {
  const presetJson = customPresetJson ?? PRESETS[currentPreset];
  const loaded = loadPreset(presetJson);
  const instance = new PuppetFlowRuntime().loadPreset(loaded);

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
  await instance.start();

  if (generation !== startupGeneration) {
    await instance.stop();
    throw new StaleRuntimeStartup();
  }

  runtime = instance;
  bindPipelineListeners(instance);
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
    savedState = runtime.state.getAll();
    await runtime.stop();
    runtime = null;
  }

  startupPromise = null;
  const instance = await ensureRuntime();
  restoreState(instance, savedState);
  return instance;
}

export async function shutdownRuntime(): Promise<void> {
  startupGeneration++;
  startupPromise = null;

  if (!runtime) {
    return;
  }

  const instance = runtime;
  runtime = null;
  await instance.stop();
}

export async function ensureRuntime(): Promise<PuppetFlowRuntime> {
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
