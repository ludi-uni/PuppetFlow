import type { Adapter, MotionFrameAdapter } from "@puppetflow/adapter-core";
import {
  executeBehaviorWithInvocations,
  type BehaviorBlock,
} from "@puppetflow/behavior";
import {
  addMotionState,
  cloneMotionFrame,
  createEmptyMotionState,
  TimelineStore,
  normalizeMotionFrame,
  type MotionFrame,
  type BehaviorPlugin,
  type ChannelStore,
  type MotionState,
  type PluginInputStores,
  type StateStore,
  type TimelineEvent,
} from "@puppetflow/core";
import {
  applyModifierChain,
  DEFAULT_MODIFIER_ORDER,
  type MotionModifier,
} from "@puppetflow/modifier-core";
import {
  createMotionFrameGraphController,
  executeMotionGraph,
  type MotionFrameGraphController,
  type MotionFrameGraphDocument,
  type MotionFrameGraphSnapshot,
  type MotionGraphDocument,
  type MotionGraphSignalValue,
} from "@puppetflow/motion-graph";
import {
  executeExtensions,
  executePfScriptFunction,
  type PresetExtensions,
} from "@puppetflow/extension-core";
import { getBundledMotionRegistry } from "@puppetflow/extension-bundled";
import type {
  MotionFrameInput,
  MotionFramePipeline,
  MotionMixerInspection,
  MotionLayerPolicy,
} from "@puppetflow/motion-pipeline";
import {
  createRuntimeStatefulRegistry,
  runStatefulNumber,
  StatefulStore,
  type FrameContext,
  type StatefulEntrySnapshot,
} from "@puppetflow/stateful-core";
import type { BehaviorPluginContext } from "@puppetflow/core";
import type { LoadedPreset } from "@puppetflow/preset";
import {
  applyPartialMotionAbsolute,
  MicroBehaviorEngine,
  type MicroBehaviorSnapshot,
} from "@puppetflow/micro-behavior";
import {
  isPollingStateSource,
  MotionOverrideStore,
  type MotionSource,
  type SourceUpdateTarget,
  type StateSource,
} from "@puppetflow/source-core";
import { applyMotionFailSafe, type MotionFailSafeOptions } from "./motion-failsafe.js";
import {
  calculateRateHz,
  cloneMotionMixerInspection,
  type MotionInspectorSnapshot,
} from "./motion-inspector.js";
import { RuntimeChannelStore } from "./runtime-channel-store.js";
import { StateSourceScheduler } from "./source-scheduler.js";
import { RuntimeStateStore } from "./state-store.js";

const TICK_INTERVAL_MS = 1000 / 60;
const DEFAULT_DELTA_TIME = TICK_INTERVAL_MS / 1000;

export type MotionListener = (motion: MotionState) => void;

export interface PluginOutputSnapshot {
  pluginId: string;
  output: Partial<MotionState>;
}

export type MotionUpdateListener = (update: {
  target: MotionState;
  rendered: MotionState;
  pluginOutputs: PluginOutputSnapshot[];
  channels: Record<string, number | string | boolean>;
  activeTimelineEvents: TimelineEvent[];
  timelineCurrentMs: number;
  statefulSnapshot: StatefulEntrySnapshot[];
  microBehavior: MicroBehaviorSnapshot;
}) => void;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function pruneEventTimes(times: number[], currentTime: number): void {
  const cutoff = currentTime - 1000;
  while (times.length > 0 && times[0]! < cutoff) {
    times.shift();
  }
}

function cloneMotionFrameGraphSnapshot(
  snapshot: MotionFrameGraphSnapshot,
): MotionFrameGraphSnapshot {
  return {
    stateId: snapshot.stateId,
    enteredAt: snapshot.enteredAt,
    policy: Object.fromEntries(
      Object.entries(snapshot.policy).map(([sourceId, override]) => [
        sourceId,
        { ...override },
      ]),
    ),
  };
}

interface MotionSourceHealth {
  connected: boolean;
  stale: boolean;
  lastFrameAt?: number;
  lastFrameTimestamp?: number;
  receiptTimes: number[];
}

interface MotionOutputHealth {
  connected: boolean;
  lastOutputAt?: number;
  outputTimes: number[];
  error?: string;
}

export class PuppetFlowRuntime {
  readonly state: StateStore = new RuntimeStateStore(() => this.scheduleTick());
  readonly channels: ChannelStore = new RuntimeChannelStore(() => this.scheduleTick());
  readonly timeline: TimelineStore = new TimelineStore();
  readonly microBehavior = new MicroBehaviorEngine();

  private readonly plugins: BehaviorPlugin[] = [];
  private readonly adapters: Adapter[] = [];
  private readonly motionFrameAdapters: MotionFrameAdapter[] = [];
  private readonly modifiers: MotionModifier[] = [];
  private readonly sources: StateSource[] = [];
  private readonly sourceLifecycleObjects = new Set<StateSource>();
  private readonly sourceScheduler = new StateSourceScheduler({
    onError: (source, error) => {
      console.error(`[PuppetFlowRuntime] source "${source.id}" update failed`, error);
    },
  });
  private readonly motionSources: MotionSource[] = [];
  private readonly latestMotionFrames = new Map<string, MotionFrame>();
  private readonly motionSourceHealth = new Map<string, MotionSourceHealth>();
  private readonly motionOutputHealth = new Map<string, MotionOutputHealth>();
  private motionPipeline: MotionFramePipeline | undefined;
  private motionMixerInspection: MotionMixerInspection | undefined;
  private motionFailSafeOptions: MotionFailSafeOptions | undefined;
  private motionFrameGraph: MotionFrameGraphController | undefined;
  private motionFrameGraphSnapshot: MotionFrameGraphSnapshot | undefined;
  private readonly motionListeners = new Set<MotionListener>();
  private readonly motionUpdateListeners = new Set<MotionUpdateListener>();

  private targetMotion = createEmptyMotionState();
  private renderedMotion = createEmptyMotionState();
  private pluginOutputs: PluginOutputSnapshot[] = [];
  private modifierOrder: readonly string[] = DEFAULT_MODIFIER_ORDER;
  private activePresetName: string | null = null;
  private behaviorRoot: BehaviorBlock = { type: "Block", statements: [] };
  private motionGraph: MotionGraphDocument = { nodes: [], edges: [] };
  private presetExtensions: PresetExtensions | undefined;
  private elapsedTime = 0;
  private frameNumber = 0;
  private readonly statefulStore = new StatefulStore();
  private readonly statefulRegistry = createRuntimeStatefulRegistry();
  private timelineCurrentMs = 0;
  private activeTimelineEvents: TimelineEvent[] = [];

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lifecycleGeneration = 0;
  private lifecycleRequest = 0;
  private desiredRunning = false;
  private requestedStartPromise: Promise<void> | undefined;
  private startPromise: Promise<void> | undefined;
  private stopPromise: Promise<void> | undefined;
  private restartGate: Promise<void> | undefined;
  private startupGeneration: number | undefined;
  private startupPhase: "initializing" | "motion-sources" | "initial-tick" | undefined;
  private tickPending = false;
  private tickInProgress = false;
  private lastTickTime: number | null = null;
  private adaptersInitialized = false;
  private readonly initializedAdapterObjects = new Set<Adapter | MotionFrameAdapter>();
  private sourcesInitialized = false;
  private readonly startedMotionSources = new Set<MotionSource>();
  private readonly motionOverride = new MotionOverrideStore();

  use(plugin: BehaviorPlugin): this {
    this.plugins.push(plugin);
    return this;
  }

  attachAdapter(adapter: Adapter): this {
    this.adapters.push(adapter);
    this.ensureMotionOutputHealth(adapter.id);
    return this;
  }

  attachMotionAdapter(adapter: MotionFrameAdapter): this {
    this.motionFrameAdapters.push(adapter);
    this.ensureMotionOutputHealth(adapter.id);
    return this;
  }

  useModifier(modifier: MotionModifier): this {
    this.modifiers.push(modifier);
    return this;
  }

  attachSource(source: StateSource): this {
    this.sources.push(source);
    return this;
  }

  attachMotionSource(source: MotionSource): this {
    this.motionSources.push(source);
    this.motionSourceHealth.set(source.id, {
      connected: false,
      stale: false,
      receiptTimes: [],
    });
    return this;
  }

  attachMotionPipeline(pipeline: MotionFramePipeline): this {
    this.motionPipeline = pipeline;
    return this;
  }

  attachMotionFrameGraph(graph: MotionFrameGraphDocument): this {
    this.motionFrameGraph = createMotionFrameGraphController(graph);
    this.motionFrameGraphSnapshot = this.motionFrameGraph.snapshot();
    return this;
  }

  setMotionGraphSignal(key: string, value: MotionGraphSignalValue): this {
    if (!this.motionFrameGraph) {
      throw new Error("No MotionFrameGraph is attached");
    }
    this.motionFrameGraph.setSignal(key, value);
    return this;
  }

  getMotionFrameGraphState(): MotionFrameGraphSnapshot | undefined {
    return this.motionFrameGraphSnapshot
      ? cloneMotionFrameGraphSnapshot(this.motionFrameGraphSnapshot)
      : undefined;
  }

  getMicroBehaviorSnapshot(): MicroBehaviorSnapshot {
    return this.microBehavior.getSnapshot();
  }

  getAdapters(): readonly Adapter[] {
    return this.adapters;
  }

  getMotionFrameAdapters(): readonly MotionFrameAdapter[] {
    return this.motionFrameAdapters;
  }

  getMotionSources(): readonly MotionSource[] {
    return this.motionSources;
  }

  getMotionPipeline(): MotionFramePipeline | undefined {
    return this.motionPipeline;
  }

  configureMotionFailSafe(options: MotionFailSafeOptions): this {
    applyMotionFailSafe({ timestamp: 0 }, 0, options);
    this.motionFailSafeOptions = { ...options };
    return this;
  }

  getMotionFailSafe(): MotionFailSafeOptions | undefined {
    return this.motionFailSafeOptions ? { ...this.motionFailSafeOptions } : undefined;
  }

  getMotionInspectorSnapshot(): MotionInspectorSnapshot {
    const timestamp = now();
    const sources = this.motionSources.map((source) => {
      const health = this.motionSourceHealth.get(source.id) ?? {
        connected: false,
        stale: false,
        receiptTimes: [],
      };
      const ageMs =
        health.lastFrameAt === undefined
          ? undefined
          : Math.max(0, timestamp - health.lastFrameAt);
      const stale =
        health.stale ||
        (ageMs !== undefined &&
          this.motionFailSafeOptions !== undefined &&
          ageMs >= this.motionFailSafeOptions.timeoutMs);
      return {
        id: source.id,
        connected: health.connected,
        stale,
        inputRateHz: calculateRateHz(health.receiptTimes, timestamp),
        ...(health.lastFrameAt === undefined
          ? {}
          : { lastFrameAt: health.lastFrameAt }),
        ...(health.lastFrameTimestamp === undefined
          ? {}
          : { lastFrameTimestamp: health.lastFrameTimestamp }),
        ...(ageMs === undefined ? {} : { ageMs }),
      };
    });
    const outputs = [...this.adapters, ...this.motionFrameAdapters].map((adapter) => {
      const health = this.ensureMotionOutputHealth(adapter.id);
      return {
        id: adapter.id,
        connected: health.connected,
        outputRateHz: calculateRateHz(health.outputTimes, timestamp),
        ...(health.lastOutputAt === undefined
          ? {}
          : { lastOutputAt: health.lastOutputAt }),
        ...(health.error === undefined ? {} : { error: health.error }),
      };
    });

    return {
      timestamp,
      running: this.running,
      sources,
      mixer: cloneMotionMixerInspection(this.motionMixerInspection),
      outputs,
    };
  }

  private ensureMotionOutputHealth(id: string): MotionOutputHealth {
    const existing = this.motionOutputHealth.get(id);
    if (existing) {
      return existing;
    }
    const health: MotionOutputHealth = {
      connected: false,
      outputTimes: [],
    };
    this.motionOutputHealth.set(id, health);
    return health;
  }

  private recordMotionOutputSuccess(id: string): void {
    const health = this.ensureMotionOutputHealth(id);
    const outputAt = now();
    health.connected = true;
    health.lastOutputAt = outputAt;
    health.error = undefined;
    health.outputTimes.push(outputAt);
    pruneEventTimes(health.outputTimes, outputAt);
  }

  private recordMotionOutputFailure(id: string, error: unknown): void {
    const health = this.ensureMotionOutputHealth(id);
    health.connected = false;
    health.error = error instanceof Error ? error.message : String(error);
  }

  private resetMotionOutputHealth(): void {
    for (const health of this.motionOutputHealth.values()) {
      health.connected = false;
      health.lastOutputAt = undefined;
      health.outputTimes.length = 0;
      health.error = undefined;
    }
  }

  getModifiers(): readonly MotionModifier[] {
    return this.modifiers;
  }

  getPlugins(): readonly BehaviorPlugin[] {
    return this.plugins;
  }

  getPluginOutputs(): readonly PluginOutputSnapshot[] {
    return this.pluginOutputs;
  }

  getActivePresetName(): string | null {
    return this.activePresetName;
  }

  loadPreset(loaded: LoadedPreset): this {
    this.plugins.length = 0;
    this.modifiers.length = 0;

    this.behaviorRoot = loaded.behavior;
    this.motionGraph = loaded.graph;
    this.presetExtensions = loaded.extensions;
    this.elapsedTime = 0;
    this.frameNumber = 0;
    this.statefulStore.reset();

    for (const plugin of loaded.plugins) {
      this.use(plugin);
    }

    this.modifierOrder = DEFAULT_MODIFIER_ORDER;
    this.activePresetName = loaded.name;
    return this;
  }

  start(): Promise<void> {
    if (this.desiredRunning) {
      if (this.requestedStartPromise) {
        return this.requestedStartPromise;
      }
      if (this.startPromise) {
        return this.startPromise;
      }
      if (this.running) {
        return Promise.resolve();
      }
    }

    const request = ++this.lifecycleRequest;
    this.desiredRunning = true;
    const requestedStart = this.requestStart(request);
    if (!this.isStartRequested(request)) {
      return requestedStart;
    }

    this.requestedStartPromise = requestedStart;
    void requestedStart.then(
      () => {
        if (this.requestedStartPromise === requestedStart) {
          this.requestedStartPromise = undefined;
        }
      },
      () => {
        if (this.requestedStartPromise === requestedStart) {
          this.requestedStartPromise = undefined;
        }
      },
    );
    return requestedStart;
  }

  private requestStart(request: number): Promise<void> {
    if (!this.isStartRequested(request)) {
      return Promise.resolve();
    }

    if (this.restartGate) {
      return this.restartGate.then(() => this.requestStart(request));
    }

    if (this.stopPromise) {
      return this.stopPromise.then(() => this.requestStart(request));
    }

    if (this.startPromise) {
      if (this.startupGeneration !== this.lifecycleGeneration) {
        return this.startPromise.then(
          () => this.requestStart(request),
          () => this.requestStart(request),
        );
      }
      return this.startPromise;
    }

    if (this.running) {
      return Promise.resolve();
    }

    return this.beginStart();
  }

  private beginStart(): Promise<void> {
    const generation = ++this.lifecycleGeneration;
    let resolveStart!: () => void;
    let rejectStart!: (reason?: unknown) => void;
    const startPromise = new Promise<void>((resolve, reject) => {
      resolveStart = resolve;
      rejectStart = reject;
    });
    this.startPromise = startPromise;

    void this.performStart(generation).then(
      () => {
        if (this.startPromise === startPromise) {
          this.startPromise = undefined;
        }
        resolveStart();
      },
      (error) => {
        if (this.startPromise === startPromise) {
          this.startPromise = undefined;
        }
        rejectStart(error);
      },
    );
    return startPromise;
  }

  stop(): Promise<void> {
    this.lifecycleRequest += 1;
    this.desiredRunning = false;
    this.requestedStartPromise = undefined;

    if (this.stopPromise) {
      return this.stopPromise;
    }

    if (this.restartGate) {
      return this.restartGate;
    }

    const pendingStart = this.startPromise;
    const waitForStartup =
      pendingStart !== undefined && this.startupPhase !== "initial-tick";
    const shouldDispose = this.running || pendingStart !== undefined;
    this.lifecycleGeneration += 1;
    this.running = false;
    this.tickPending = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    let resolveStop!: () => void;
    let rejectStop!: (reason?: unknown) => void;
    const stopPromise = new Promise<void>((resolve, reject) => {
      resolveStop = resolve;
      rejectStop = reject;
    });
    this.stopPromise = stopPromise;

    void this.performStop(pendingStart, waitForStartup, shouldDispose).then(
      () => {
        if (this.stopPromise === stopPromise) {
          this.stopPromise = undefined;
        }
        resolveStop();
      },
      (error) => {
        if (this.stopPromise === stopPromise) {
          this.stopPromise = undefined;
        }
        rejectStop(error);
      },
    );
    return stopPromise;
  }

  private async performStart(generation: number): Promise<void> {
    this.startupGeneration = generation;
    this.startupPhase = "initializing";
    const isCurrent = () => this.isStartCurrent(generation);

    try {
      if (!this.adaptersInitialized) {
        await this.initializeAdapters(isCurrent);
      }
      if (!isCurrent()) {
        return;
      }

      if (!this.sourcesInitialized) {
        await this.initializeSources(isCurrent);
      }
      if (!isCurrent()) {
        return;
      }

      this.running = true;
      this.lastTickTime = null;
      this.startupPhase = "motion-sources";
      this.sourceScheduler.start(this.sources);
      if (!isCurrent()) {
        return;
      }

      await this.startMotionSources(isCurrent);
      if (!isCurrent()) {
        return;
      }

      this.startupPhase = "initial-tick";
      await this.tick();
      if (!isCurrent()) {
        return;
      }

      this.intervalId = setInterval(() => {
        void this.tick();
      }, TICK_INTERVAL_MS);
    } catch (error) {
      if (isCurrent()) {
        await this.rollbackFailedStart();
      }
      throw error;
    } finally {
      if (this.startupGeneration === generation) {
        this.startupGeneration = undefined;
        this.startupPhase = undefined;
      }
    }
  }

  private async rollbackFailedStart(): Promise<void> {
    this.lifecycleGeneration += 1;
    this.lifecycleRequest += 1;
    this.desiredRunning = false;
    this.requestedStartPromise = undefined;
    this.running = false;
    this.tickPending = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    const schedulerStop = this.sourceScheduler.stop();
    try {
      await schedulerStop;
    } catch {
      // The original startup error remains authoritative.
    }

    if (!(await this.waitForTickCompletion())) {
      this.beginRestartGate(undefined);
      return;
    }

    try {
      await this.cleanupStoppedResources();
    } catch {
      // The original startup error remains authoritative.
    }
  }

  private async performStop(
    pendingStart: Promise<void> | undefined,
    waitForStartup: boolean,
    shouldDispose: boolean,
  ): Promise<void> {
    const schedulerStop = this.sourceScheduler.stop();
    let startupError: unknown;
    let schedulerError: unknown;
    let startupFailed = false;
    let schedulerFailed = false;

    if (pendingStart && waitForStartup) {
      try {
        await pendingStart;
      } catch (error) {
        startupFailed = true;
        startupError = error;
      }
    }

    try {
      await schedulerStop;
    } catch (error) {
      schedulerFailed = true;
      schedulerError = error;
    }

    if (!shouldDispose) {
      this.resetMotionFrameGraph();
      this.throwLifecycleError(
        startupFailed,
        startupError,
        schedulerFailed,
        schedulerError,
      );
      return;
    }

    if (!(await this.waitForTickCompletion())) {
      this.beginRestartGate(pendingStart);
      return;
    }

    if (pendingStart && !waitForStartup) {
      try {
        await pendingStart;
      } catch (error) {
        startupFailed = true;
        startupError = error;
      }
    }

    await this.cleanupStoppedResources();
    this.throwLifecycleError(
      startupFailed,
      startupError,
      schedulerFailed,
      schedulerError,
    );
  }

  private async waitForTickCompletion(): Promise<boolean> {
    let spinCount = 0;
    while (this.tickInProgress) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
      if (++spinCount > 200) {
        console.warn(
          "[PuppetFlowRuntime] stop() timed out waiting for tick; skipping dispose to avoid races",
        );
        this.resetMotionFrameGraph();
        return false;
      }
    }
    return true;
  }

  private beginRestartGate(pendingStart: Promise<void> | undefined): void {
    if (this.restartGate) {
      return;
    }

    const restartGate = this.finishQuiescing(pendingStart);
    this.restartGate = restartGate;
    void restartGate.then(() => {
      if (this.restartGate === restartGate) {
        this.restartGate = undefined;
      }
    });
  }

  private async finishQuiescing(
    pendingStart: Promise<void> | undefined,
  ): Promise<void> {
    while (this.tickInProgress) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }

    if (pendingStart) {
      try {
        await pendingStart;
      } catch {
        // The original stop already surfaced this startup error when appropriate.
      }
    }

    await this.cleanupStoppedResources();
  }

  private async cleanupStoppedResources(): Promise<void> {
    await this.disposeAdapters();
    await this.disposeSources();
    await this.stopMotionSources();
    this.resetMotionPipeline();
    this.resetMotionFrameGraph();
    this.motionMixerInspection = undefined;
    this.resetMotionOutputHealth();
    this.motionOverride.clear();
    this.microBehavior.reset();
    this.statefulStore.reset();
    this.elapsedTime = 0;
    this.frameNumber = 0;
  }

  private throwLifecycleError(
    startupFailed: boolean,
    startupError: unknown,
    schedulerFailed: boolean,
    schedulerError: unknown,
  ): void {
    if (startupFailed) {
      throw startupError;
    }
    if (schedulerFailed) {
      throw schedulerError;
    }
  }

  private isStartCurrent(generation: number): boolean {
    return this.lifecycleGeneration === generation;
  }

  private isStartRequested(request: number): boolean {
    return this.lifecycleRequest === request && this.desiredRunning;
  }

  isRunning(): boolean {
    return this.running;
  }

  getTargetMotion(): MotionState {
    return { ...this.targetMotion };
  }

  getRenderedMotion(): MotionState {
    return { ...this.renderedMotion };
  }

  getTimelineCurrentMs(): number {
    return this.timelineCurrentMs;
  }

  getActiveTimelineEvents(): readonly TimelineEvent[] {
    return this.activeTimelineEvents;
  }

  private getPluginInput(): PluginInputStores {
    return {
      state: this.state,
      channels: this.channels,
    };
  }

  private getSourceUpdateTarget(): SourceUpdateTarget {
    return {
      state: this.state,
      channels: this.channels,
      timeline: this.timeline,
      motion: this.motionOverride,
      microBehavior: {
        applyFromInputRecord: (record: Record<string, unknown>) => {
          this.microBehavior.applyFromInputRecord(record);
        },
      },
    };
  }

  private getPipelineSnapshotExtras() {
    return {
      channels: this.channels.getAll(),
      activeTimelineEvents: this.activeTimelineEvents,
      timelineCurrentMs: this.timelineCurrentMs,
      statefulSnapshot: this.statefulStore.snapshot(),
      microBehavior: this.microBehavior.getSnapshot(),
    };
  }

  onMotionUpdate(listener: MotionListener): () => void {
    this.motionListeners.add(listener);
    listener(this.renderedMotion);
    return () => {
      this.motionListeners.delete(listener);
    };
  }

  onMotionPipelineUpdate(listener: MotionUpdateListener): () => void {
    this.motionUpdateListeners.add(listener);
    listener({
      target: this.targetMotion,
      rendered: this.renderedMotion,
      pluginOutputs: this.pluginOutputs,
      ...this.getPipelineSnapshotExtras(),
    });
    return () => {
      this.motionUpdateListeners.delete(listener);
    };
  }

  private scheduleTick(): void {
    if (!this.running || this.tickPending) {
      return;
    }

    this.tickPending = true;
    queueMicrotask(() => {
      this.tickPending = false;
      if (this.running) {
        void this.tick();
      }
    });
  }

  private async initializeAdapters(isCurrent: () => boolean): Promise<void> {
    const adapters: Array<Adapter | MotionFrameAdapter> = [
      ...this.adapters,
      ...this.motionFrameAdapters,
    ];
    for (const adapter of adapters) {
      if (!isCurrent()) {
        return;
      }

      this.ensureMotionOutputHealth(adapter.id);
      if (this.initializedAdapterObjects.has(adapter)) {
        continue;
      }
      this.initializedAdapterObjects.add(adapter);
      try {
        await adapter.initialize();
        const health = this.ensureMotionOutputHealth(adapter.id);
        health.connected = true;
        health.error = undefined;
      } catch (error) {
        this.recordMotionOutputFailure(adapter.id, error);
        console.error(
          `[PuppetFlowRuntime] adapter "${adapter.id}" initialize failed`,
          error,
        );
      }

      if (!isCurrent()) {
        return;
      }
    }

    if (isCurrent()) {
      this.adaptersInitialized = true;
    }
  }

  private async disposeAdapters(): Promise<void> {
    for (const adapter of this.initializedAdapterObjects) {
      try {
        await adapter.dispose();
      } catch (error) {
        console.error(
          `[PuppetFlowRuntime] adapter "${adapter.id}" dispose failed`,
          error,
        );
      }
    }

    this.adaptersInitialized = false;
    this.initializedAdapterObjects.clear();
    this.resetMotionOutputHealth();
  }

  private async initializeSources(isCurrent: () => boolean): Promise<void> {
    const initializedSources = new Set<StateSource>();
    for (const source of this.sources) {
      if (!isCurrent()) {
        return;
      }

      if (initializedSources.has(source)) {
        continue;
      }
      initializedSources.add(source);
      this.sourceLifecycleObjects.add(source);
      try {
        await source.initialize();
      } catch (error) {
        console.error(
          `[PuppetFlowRuntime] source "${source.id}" initialize failed`,
          error,
        );
      }

      if (!isCurrent()) {
        return;
      }
    }

    if (isCurrent()) {
      this.sourcesInitialized = true;
    }
  }

  private async disposeSources(): Promise<void> {
    for (const source of this.sourceLifecycleObjects) {
      try {
        await source.dispose();
      } catch (error) {
        console.error(
          `[PuppetFlowRuntime] source "${source.id}" dispose failed`,
          error,
        );
      }
    }

    this.sourcesInitialized = false;
    this.sourceLifecycleObjects.clear();
  }

  private async startMotionSources(isCurrent: () => boolean): Promise<void> {
    const attemptedMotionSources = new Set<MotionSource>();
    for (const source of this.motionSources) {
      if (!isCurrent()) {
        return;
      }

      if (attemptedMotionSources.has(source)) {
        continue;
      }
      attemptedMotionSources.add(source);

      const health = this.motionSourceHealth.get(source.id);
      if (health) {
        health.connected = false;
        health.stale = false;
      }
      this.startedMotionSources.add(source);
      try {
        await source.start((frame) => {
          this.acceptMotionFrame(source, frame);
        });
        if (health) {
          health.connected = true;
        }
      } catch (error) {
        console.error(
          `[PuppetFlowRuntime] motion source "${source.id}" start failed`,
          error,
        );
        if (health) {
          health.connected = false;
        }
      }

      if (!isCurrent()) {
        return;
      }
    }
  }

  private async stopMotionSources(): Promise<void> {
    if (this.startedMotionSources.size === 0) {
      this.latestMotionFrames.clear();
      return;
    }

    for (const source of this.startedMotionSources) {
      try {
        await source.stop();
      } catch (error) {
        console.error(
          `[PuppetFlowRuntime] motion source "${source.id}" stop failed`,
          error,
        );
      }
      const health = this.motionSourceHealth.get(source.id);
      if (health) {
        health.connected = false;
        health.stale = false;
        health.lastFrameAt = undefined;
        health.lastFrameTimestamp = undefined;
        health.receiptTimes.length = 0;
      }
    }
    this.startedMotionSources.clear();
    this.latestMotionFrames.clear();
  }

  private acceptMotionFrame(source: MotionSource, frame: MotionFrame): void {
    if (!this.running) {
      return;
    }

    try {
      const normalized = normalizeMotionFrame(frame);
      this.latestMotionFrames.set(source.id, normalized);
      const health = this.motionSourceHealth.get(source.id);
      if (health) {
        const receivedAt = now();
        health.connected = true;
        health.stale = false;
        health.lastFrameAt = receivedAt;
        health.lastFrameTimestamp = normalized.timestamp;
        health.receiptTimes.push(receivedAt);
        pruneEventTimes(health.receiptTimes, receivedAt);
      }
    } catch (error) {
      console.error(
        `[PuppetFlowRuntime] motion source "${source.id}" frame rejected`,
        error,
      );
    }
  }

  private async tick(): Promise<void> {
    if (!this.running || this.tickInProgress) {
      return;
    }

    this.tickInProgress = true;

    try {
      const sourceTarget = this.getSourceUpdateTarget();
      this.sourceScheduler.capture();

      const currentTime = now();
      const deltaTime =
        this.lastTickTime === null
          ? DEFAULT_DELTA_TIME
          : (currentTime - this.lastTickTime) / 1000;
      this.lastTickTime = currentTime;
      this.elapsedTime += deltaTime;
      const frame: FrameContext = {
        deltaTime,
        frameNumber: this.frameNumber++,
        elapsedTime: this.elapsedTime,
      };
      this.timelineCurrentMs = Math.floor(this.elapsedTime * 1000);
      this.activeTimelineEvents = this.timeline.getActiveEvents(this.timelineCurrentMs);

      for (const source of this.sources) {
        if (!this.running) {
          return;
        }

        if (
          isPollingStateSource(source) &&
          this.sourceScheduler.drainSource(source, sourceTarget)
        ) {
          continue;
        }

        this.sourceLifecycleObjects.add(source);
        try {
          await source.update(sourceTarget);
        } catch (error) {
          console.error(
            `[PuppetFlowRuntime] source "${source.id}" update failed`,
            error,
          );
        }
      }

      if (!this.running) {
        return;
      }

      const pluginInput = this.getPluginInput();
      const pluginContext: BehaviorPluginContext = {
        deltaTime,
        time: this.elapsedTime,
        frame,
        runStatefulNumber: (functionName, instanceId, config, input) =>
          runStatefulNumber(
            {
              deltaTime,
              time: this.elapsedTime,
              frame,
              statefulStore: this.statefulStore,
              statefulRegistry: this.statefulRegistry,
            },
            functionName,
            instanceId,
            config,
            input ?? 0,
          ),
      };
      const pipelineOutputs: PluginOutputSnapshot[] = [];
      const partials: Partial<MotionState>[] = [];

      for (const plugin of this.plugins) {
        if (!this.running) {
          return;
        }

        if (plugin.id === "blink" && this.microBehavior.isActive()) {
          pipelineOutputs.push({ pluginId: plugin.id, output: {} });
          partials.push({});
          continue;
        }

        try {
          const output = plugin.process(
            pluginInput,
            this.renderedMotion,
            pluginContext,
          );
          pipelineOutputs.push({ pluginId: plugin.id, output });
          partials.push(output);
        } catch (error) {
          console.error(`[PuppetFlowRuntime] plugin "${plugin.id}" failed`, error);
          pipelineOutputs.push({ pluginId: plugin.id, output: {} });
        }
      }

      let behaviorPackInvocations: Array<{
        kind: "pack";
        id: string;
        config: Record<string, number>;
      }> = [];

      try {
        const behaviorResult = executeBehaviorWithInvocations(this.behaviorRoot, {
          state: this.state,
          channels: this.channels,
          renderedMotion: this.renderedMotion,
          deltaTime,
          time: this.elapsedTime,
          frameNumber: frame.frameNumber,
          frame,
          statefulStore: this.statefulStore,
          statefulRegistry: this.statefulRegistry,
          activeTimelineEvents: this.activeTimelineEvents,
        });
        behaviorPackInvocations = behaviorResult.packInvocations.map((invocation) => ({
          kind: "pack" as const,
          id: invocation.packId,
          config: invocation.config ?? {},
        }));
        pipelineOutputs.push({ pluginId: "behavior", output: behaviorResult.motion });
        partials.push(behaviorResult.motion);
      } catch (error) {
        console.error("[PuppetFlowRuntime] behavior execution failed", error);
        pipelineOutputs.push({ pluginId: "behavior", output: {} });
      }

      try {
        const graphOutput = executeMotionGraph(this.motionGraph, {
          state: this.state,
          channels: this.channels,
          timeline: this.timeline,
          timelineCurrentMs: this.timelineCurrentMs,
          activeTimelineEvents: this.activeTimelineEvents,
          deltaTime,
          time: this.elapsedTime,
          frame,
          statefulStore: this.statefulStore,
          statefulRegistry: this.statefulRegistry,
          evaluateExtensionFunction: (functionName, args) =>
            executePfScriptFunction(
              getBundledMotionRegistry(),
              {
                state: this.state,
                channels: this.channels,
                deltaTime,
                time: this.elapsedTime,
                timelineCurrentMs: this.timelineCurrentMs,
                activeTimelineEvents: this.activeTimelineEvents,
                motion: this.renderedMotion,
                custom: this.renderedMotion.custom ?? {},
                statefulStore: this.statefulStore,
                statefulRegistry: this.statefulRegistry,
                frame,
              },
              functionName,
              args,
            ),
        });
        pipelineOutputs.push({ pluginId: "graph", output: graphOutput });
        partials.push(graphOutput);
      } catch (error) {
        console.error("[PuppetFlowRuntime] motion graph execution failed", error);
        pipelineOutputs.push({ pluginId: "graph", output: {} });
      }

      this.pluginOutputs = pipelineOutputs;
      this.targetMotion = addMotionState(createEmptyMotionState(), partials);
      this.renderedMotion = applyModifierChain(
        this.renderedMotion,
        this.targetMotion,
        this.modifiers,
        this.modifierOrder,
        deltaTime,
      );

      try {
        const extensionResult = executeExtensions(
          getBundledMotionRegistry(),
          {
            state: this.state,
            channels: this.channels,
            deltaTime,
            time: this.elapsedTime,
            timelineCurrentMs: this.timelineCurrentMs,
            activeTimelineEvents: this.activeTimelineEvents,
            motion: this.renderedMotion,
            statefulStore: this.statefulStore,
            statefulRegistry: this.statefulRegistry,
            frame,
          },
          {
            presetExtensions: this.presetExtensions,
            graph: this.motionGraph,
            behaviorPackInvocations,
          },
        );
        this.renderedMotion = extensionResult.standard;
        pipelineOutputs.push({
          pluginId: "extensions",
          output: { custom: extensionResult.custom },
        });
      } catch (error) {
        console.error("[PuppetFlowRuntime] extension layer failed", error);
        pipelineOutputs.push({ pluginId: "extensions", output: {} });
      }

      if (!this.running) {
        return;
      }

      const microBehaviorResult = this.microBehavior.tick(deltaTime);
      if (microBehaviorResult) {
        this.renderedMotion = applyPartialMotionAbsolute(
          this.renderedMotion,
          microBehaviorResult.motion,
          microBehaviorResult.activeKeys,
          microBehaviorResult.customKeys,
        );
        pipelineOutputs.push({
          pluginId: "micro-behavior",
          output: microBehaviorResult.motion,
        });
      }

      this.renderedMotion = this.motionOverride.applyTo(this.renderedMotion);

      for (const adapter of this.adapters) {
        if (!this.running) {
          return;
        }

        try {
          await adapter.update(this.renderedMotion, deltaTime);
          this.recordMotionOutputSuccess(adapter.id);
        } catch (error) {
          this.recordMotionOutputFailure(adapter.id, error);
          console.error(
            `[PuppetFlowRuntime] adapter "${adapter.id}" update failed`,
            error,
          );
        }
      }

      await this.dispatchMotionFrames(deltaTime);

      for (const listener of this.motionListeners) {
        listener(this.renderedMotion);
      }

      for (const listener of this.motionUpdateListeners) {
        listener({
          target: this.targetMotion,
          rendered: this.renderedMotion,
          pluginOutputs: this.pluginOutputs,
          ...this.getPipelineSnapshotExtras(),
        });
      }
    } finally {
      this.tickInProgress = false;
    }
  }

  private async dispatchMotionFrames(deltaTime: number): Promise<void> {
    const inputs: MotionFrameInput[] = [];
    const currentTime = now();
    for (const source of this.motionSources) {
      const latestFrame = this.latestMotionFrames.get(source.id);
      if (latestFrame) {
        const health = this.motionSourceHealth.get(source.id);
        const ageMs =
          health?.lastFrameAt === undefined
            ? 0
            : Math.max(0, currentTime - health.lastFrameAt);
        const safe = this.motionFailSafeOptions
          ? applyMotionFailSafe(latestFrame, ageMs, this.motionFailSafeOptions)
          : { stale: false, frame: cloneMotionFrame(latestFrame) };
        if (health) {
          health.stale = safe.stale;
        }
        if (safe.frame) {
          inputs.push({ sourceId: source.id, frame: safe.frame });
        }
      }
    }

    let policy: MotionLayerPolicy | undefined;
    if (this.motionFrameGraph) {
      const sources = Object.fromEntries(
        this.motionSources.map((source) => {
          const health = this.motionSourceHealth.get(source.id);
          return [
            source.id,
            { connected: health?.connected ?? false, stale: health?.stale ?? false },
          ];
        }),
      );
      try {
        const snapshot = this.motionFrameGraph.evaluate({ sources });
        this.motionFrameGraphSnapshot = snapshot;
        policy = snapshot.policy;
      } catch (error) {
        console.error(
          "[PuppetFlowRuntime] motion frame graph evaluation failed",
          error,
        );
      }
    }

    this.motionMixerInspection = undefined;
    if (this.motionPipeline?.inspect) {
      try {
        this.motionMixerInspection = this.motionFrameGraph
          ? this.motionPipeline.inspect(inputs, policy)
          : this.motionPipeline.inspect(inputs);
      } catch (error) {
        console.error("[PuppetFlowRuntime] motion pipeline inspection failed", error);
      }
    }

    if (inputs.length === 0) {
      return;
    }

    if (this.motionPipeline) {
      try {
        const processed = this.motionFrameGraph
          ? this.motionPipeline.process(inputs, deltaTime, policy)
          : this.motionPipeline.process(inputs, deltaTime);
        if (processed) {
          await this.updateMotionFrameAdapters(processed, deltaTime);
        }
      } catch (error) {
        console.error("[PuppetFlowRuntime] motion pipeline failed", error);
      }
      return;
    }

    const rawInputs = policy
      ? inputs.filter((input) => policy[input.sourceId]?.enabled !== false)
      : inputs;
    for (const input of rawInputs) {
      await this.updateMotionFrameAdapters(input.frame, deltaTime);
    }
  }

  private async updateMotionFrameAdapters(
    frame: MotionFrame,
    deltaTime: number,
  ): Promise<void> {
    for (const adapter of this.motionFrameAdapters) {
      if (!this.running) {
        return;
      }

      try {
        await adapter.updateFrame(cloneMotionFrame(frame), deltaTime);
        this.recordMotionOutputSuccess(adapter.id);
      } catch (error) {
        this.recordMotionOutputFailure(adapter.id, error);
        console.error(
          `[PuppetFlowRuntime] motion frame adapter "${adapter.id}" update failed`,
          error,
        );
      }
    }
  }

  private resetMotionPipeline(): void {
    if (!this.motionPipeline) {
      return;
    }

    try {
      this.motionPipeline.reset();
    } catch (error) {
      console.error("[PuppetFlowRuntime] motion pipeline reset failed", error);
    }
  }

  private resetMotionFrameGraph(): void {
    if (!this.motionFrameGraph) {
      return;
    }

    this.motionFrameGraph.reset();
    this.motionFrameGraphSnapshot = this.motionFrameGraph.snapshot();
  }
}
