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
import type {
  BehaviorId,
  MicroBehaviorDefinition,
  MicroBehaviorSnapshot,
} from "@puppetflow/micro-behavior";
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
let startingRuntime: PuppetFlowRuntime | null = null;
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

type StudioPipelineListener = (update: MotionPipelineUpdate) => void;
type RuntimePipelineUpdate = Parameters<
  Parameters<PuppetFlowRuntime["onMotionPipelineUpdate"]>[0]
>[0];

const pipelineListenerSet = new Set<StudioPipelineListener>();
const pipelineListenerUnsubs = new Map<StudioPipelineListener, () => void>();
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

function attachMapperOutputs(
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

function detachPipelineListeners(): void {
  for (const unsub of pipelineListenerUnsubs.values()) {
    unsub();
  }
  pipelineListenerUnsubs.clear();
}

function pipelineUpdate(
  instance: PuppetFlowRuntime,
  update: RuntimePipelineUpdate,
): MotionPipelineUpdate {
  return {
    ...update,
    target: { ...update.target, custom: { ...update.target.custom } },
    rendered: { ...update.rendered, custom: { ...update.rendered.custom } },
    channels: { ...update.channels },
    activeTimelineEvents: update.activeTimelineEvents.map((event) => ({
      ...event,
      value: detachSnapshotValue(event.value),
    })),
    pluginOutputs: update.pluginOutputs.map((entry) => ({
      pluginId: entry.pluginId,
      output: {
        ...entry.output,
        ...(entry.output.custom === undefined
          ? {}
          : { custom: { ...entry.output.custom } }),
      },
    })),
    statefulSnapshot: update.statefulSnapshot.map((entry) => ({
      ...entry,
      state: detachSnapshotValue(entry.state),
    })),
    microBehavior: {
      status: { ...update.microBehavior.status },
      queue: { ...update.microBehavior.queue },
      cooldowns: update.microBehavior.cooldowns.map((entry) => ({ ...entry })),
    },
    activePluginIds: instance.getPlugins().map((plugin) => plugin.id),
    stateSnapshot: numericStateSnapshot(instance),
    ready: true,
  };
}

function detachSnapshotValue(
  value: unknown,
  seen = new WeakMap<object, unknown>(),
): unknown {
  if (value === null || typeof value !== "object") return value;
  const existing = seen.get(value);
  if (existing !== undefined) return existing;

  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const entry of value) copy.push(detachSnapshotValue(entry, seen));
    return copy;
  }
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof Map) {
    const copy = new Map<unknown, unknown>();
    seen.set(value, copy);
    for (const [key, entry] of value) {
      copy.set(detachSnapshotValue(key, seen), detachSnapshotValue(entry, seen));
    }
    return copy;
  }
  if (value instanceof Set) {
    const copy = new Set<unknown>();
    seen.set(value, copy);
    for (const entry of value) copy.add(detachSnapshotValue(entry, seen));
    return copy;
  }

  const copy: Record<string, unknown> = {};
  seen.set(value, copy);
  for (const [key, entry] of Object.entries(value)) {
    copy[key] = detachSnapshotValue(entry, seen);
  }
  return copy;
}

function unavailablePipelineUpdate(instance: PuppetFlowRuntime): MotionPipelineUpdate {
  return {
    target: null,
    rendered: null,
    pluginOutputs: [],
    channels: {},
    activeTimelineEvents: [],
    timelineCurrentMs: instance.getTimelineCurrentMs(),
    statefulSnapshot: [],
    microBehavior: {
      status: { activeBehavior: null, remaining: 0 },
      queue: { queueLength: 0 },
      cooldowns: [],
    },
    activePluginIds: instance.getPlugins().map((plugin) => plugin.id),
    stateSnapshot: numericStateSnapshot(instance),
    ready: false,
  };
}

function numericStateSnapshot(instance: PuppetFlowRuntime): Record<string, number> {
  return Object.fromEntries(
    Object.entries(instance.state.getAll()).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );
}

function bindPipelineListener(
  listener: StudioPipelineListener,
  instance: PuppetFlowRuntime,
): void {
  const unsubscribe = instance.onMotionPipelineUpdate((update) => {
    if (
      !pipelineListenerSet.has(listener) ||
      runtime !== instance ||
      !instance.isRunning()
    ) {
      return;
    }
    listener(pipelineUpdate(instance, update));
  });
  pipelineListenerUnsubs.set(listener, unsubscribe);
}

function bindPipelineListeners(instance: PuppetFlowRuntime): void {
  detachPipelineListeners();

  for (const listener of pipelineListenerSet) {
    bindPipelineListener(listener, instance);
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
  startingRuntime = instance;
  const control = createPuppetFlowControl(instance);
  const connection: StudioActingConnection = {
    runtime: instance,
    control,
    capabilities: control.getCapabilities(),
  };
  try {
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
  } finally {
    if (startingRuntime === instance) startingRuntime = null;
  }
}

function trackStartup(start: Promise<PuppetFlowRuntime>): Promise<PuppetFlowRuntime> {
  const tracked = start.finally(() => {
    if (startupPromise === tracked) startupPromise = null;
  });
  startupPromise = tracked;
  return tracked;
}

export async function restartRuntime(): Promise<void> {
  const generation = ++startupGeneration;

  let savedState: Record<string, StateValue> = {};
  if (runtime) {
    const instance = runtime;
    const connection = actingConnection;
    savedState = instance.state.getAll();
    const stopping = instance.stop();
    if (connection?.runtime === instance) {
      publishActingSnapshot(connection, false);
    }
    for (const listener of pipelineListenerSet) {
      listener(unavailablePipelineUpdate(instance));
    }
    detachPipelineListeners();
    detachActingListeners();
    runtime = null;
    const replacement = trackStartup(
      stopping.then(() => {
        if (generation !== startupGeneration) throw new StaleRuntimeStartup();
        return createAndStartRuntime(generation);
      }),
    );
    try {
      const instance = await replacement;
      restoreState(instance, savedState);
      return;
    } catch (error) {
      actingConnection = null;
      if (error instanceof StaleRuntimeStartup && shuttingDown) {
        throw new Error("Runtime is shutting down");
      }
      throw error;
    }
  }

  const pendingStartup = startupPromise;
  if (pendingStartup) {
    try {
      await pendingStartup;
    } catch (error) {
      if (!(error instanceof StaleRuntimeStartup)) throw error;
    }
  }

  try {
    const instance = await ensureRuntimeInstance();
    restoreState(instance, savedState);
  } catch (error) {
    actingConnection = null;
    throw error;
  }
}

export async function shutdownRuntime(): Promise<void> {
  shuttingDown = true;
  startupGeneration++;
  const pendingStartup = startupPromise;
  startupPromise = null;

  if (!runtime) {
    const pendingInstance = startingRuntime;
    const stopping = pendingInstance?.stop();
    detachPipelineListeners();
    detachActingListeners();
    actingConnection = null;
    await Promise.all([stopping, pendingStartup?.catch(() => undefined)]);
    return;
  }

  const instance = runtime;
  const connection = actingConnection;
  const stopping = instance.stop();
  if (connection?.runtime === instance) {
    publishActingSnapshot(connection, false);
  }
  for (const listener of pipelineListenerSet) {
    listener(unavailablePipelineUpdate(instance));
  }
  detachPipelineListeners();
  detachActingListeners();
  runtime = null;
  actingConnection = null;
  await stopping;
}

async function ensureRuntimeInstance(): Promise<PuppetFlowRuntime> {
  if (shuttingDown) {
    throw new Error("Runtime is shutting down");
  }

  if (runtime) {
    return runtime;
  }

  const generation = startupGeneration;

  if (!startupPromise) {
    trackStartup(createAndStartRuntime(generation));
  }
  const pendingStartup = startupPromise;
  if (!pendingStartup) throw new Error("Runtime startup was not created");

  try {
    return await pendingStartup;
  } catch (error) {
    if (error instanceof StaleRuntimeStartup) {
      if (shuttingDown) {
        throw new Error("Runtime is shutting down");
      }
      return ensureRuntimeInstance();
    }

    throw error;
  }
}

export async function ensureRuntime(): Promise<void> {
  await ensureRuntimeInstance();
}

export async function switchPreset(presetName: PresetName): Promise<void> {
  currentPreset = presetName;
  customPresetJson = null;
  await restartRuntime();
}

export async function loadCustomPreset(json: string): Promise<void> {
  customPresetJson = json;
  await restartRuntime();
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

export async function setSourceConfig(config: SourceConfig): Promise<void> {
  sourceConfig = config;
  await restartRuntime();
}

export function getSourceConfig(): SourceConfig {
  return { ...sourceConfig };
}

export async function setMapperConfig(config: MotionMapperEditorConfig): Promise<void> {
  mapperConfig = cloneMapperConfig(config);
  await restartRuntime();
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
  target: MotionState | null;
  rendered: MotionState | null;
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
  activePluginIds: string[];
  stateSnapshot: Record<string, number>;
  ready: boolean;
};

export function subscribeMotionPipeline(listener: StudioPipelineListener): () => void {
  pipelineListenerSet.add(listener);

  if (runtime) {
    bindPipelineListener(listener, runtime);
  } else {
    void ensureRuntimeInstance()
      .then((instance) => {
        if (
          pipelineListenerSet.has(listener) &&
          runtime === instance &&
          !pipelineListenerUnsubs.has(listener)
        ) {
          bindPipelineListener(listener, instance);
        }
      })
      .catch(() => undefined);
  }

  return () => {
    pipelineListenerSet.delete(listener);
    pipelineListenerUnsubs.get(listener)?.();
    pipelineListenerUnsubs.delete(listener);
  };
}

export interface StudioRuntimeInputs {
  state: Readonly<Record<string, StateValue>>;
  channels: Readonly<Record<string, StateValue>>;
  removeChannels?: readonly string[];
}

export function applyStudioRuntimeInputs(inputs: StudioRuntimeInputs): boolean {
  const instance = runtime;
  if (!instance?.isRunning()) return false;

  for (const [key, value] of Object.entries(inputs.state)) {
    instance.state.set(key, value);
  }
  for (const [key, value] of Object.entries(inputs.channels)) {
    instance.channels.set(key, value);
  }
  for (const key of inputs.removeChannels ?? []) {
    instance.channels.delete(key);
  }
  return true;
}

export function pushTimelinePhoneme(
  phoneme: string,
  durationMs: number,
): { startMs: number; endMs: number } | null {
  const instance = runtime;
  if (!instance?.isRunning()) return null;

  const startMs = instance.getTimelineCurrentMs();
  const endMs = startMs + durationMs;
  instance.timeline.push({
    startMs,
    endMs,
    type: "phoneme",
    value: { phoneme, strength: 1 },
  });
  return { startMs, endMs };
}

export function setCustomMicroBehaviorDefinitions(
  definitions: readonly MicroBehaviorDefinition[],
): boolean {
  const instance = runtime;
  if (!instance?.isRunning()) return false;
  instance.microBehavior.setCustomDefinitions(definitions);
  return true;
}

export function testCustomMicroBehavior(definition: MicroBehaviorDefinition): boolean {
  const instance = runtime;
  if (!instance?.isRunning()) return false;
  instance.microBehavior.registerDefinition(definition);
  return instance.microBehavior.request({ behavior: definition.id });
}

export function requestMicroBehavior(behavior: BehaviorId): boolean {
  const instance = runtime;
  if (!instance?.isRunning()) return false;
  return instance.microBehavior.request({ behavior });
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
    void ensureRuntimeInstance()
      .then(() => {
        if (
          actingListenerSet.has(listener) &&
          actingConnection &&
          runtime === actingConnection.runtime &&
          !actingListenerUnsubs.has(listener)
        ) {
          bindActingListener(listener, actingConnection);
        }
      })
      .catch(() => undefined);
  }

  return () => {
    actingListenerSet.delete(listener);
    actingListenerUnsubs.get(listener)?.();
    actingListenerUnsubs.delete(listener);
  };
}
