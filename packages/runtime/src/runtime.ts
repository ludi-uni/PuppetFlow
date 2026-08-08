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
import { executeMotionGraph, type MotionGraphDocument } from "@puppetflow/motion-graph";
import {
  executeExtensions,
  executePfScriptFunction,
  type PresetExtensions,
} from "@puppetflow/extension-core";
import { getBundledMotionRegistry } from "@puppetflow/extension-bundled";
import type {
  MotionFrameInput,
  MotionFramePipeline,
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
import type { MotionSource, StateSource } from "@puppetflow/source-core";
import { MotionOverrideStore } from "@puppetflow/source-core";
import {
  applyMotionFailSafe,
  type MotionFailSafeOptions,
} from "./motion-failsafe.js";
import { RuntimeChannelStore } from "./runtime-channel-store.js";
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

interface MotionSourceHealth {
  connected: boolean;
  stale: boolean;
  lastFrameAt?: number;
  lastFrameTimestamp?: number;
  receiptTimes: number[];
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
  private readonly motionSources: MotionSource[] = [];
  private readonly latestMotionFrames = new Map<string, MotionFrame>();
  private readonly motionSourceHealth = new Map<string, MotionSourceHealth>();
  private motionPipeline: MotionFramePipeline | undefined;
  private motionFailSafeOptions: MotionFailSafeOptions | undefined;
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
  private tickPending = false;
  private tickInProgress = false;
  private lastTickTime: number | null = null;
  private adaptersInitialized = false;
  private readonly initializedAdapterObjects = new Set<Adapter | MotionFrameAdapter>();
  private sourcesInitialized = false;
  private motionSourcesStarted = false;
  private readonly motionOverride = new MotionOverrideStore();

  use(plugin: BehaviorPlugin): this {
    this.plugins.push(plugin);
    return this;
  }

  attachAdapter(adapter: Adapter): this {
    this.adapters.push(adapter);
    return this;
  }

  attachMotionAdapter(adapter: MotionFrameAdapter): this {
    this.motionFrameAdapters.push(adapter);
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
    return this.motionFailSafeOptions
      ? { ...this.motionFailSafeOptions }
      : undefined;
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

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    if (!this.adaptersInitialized) {
      await this.initializeAdapters();
    }

    if (!this.sourcesInitialized) {
      await this.initializeSources();
    }

    this.running = true;
    this.lastTickTime = null;
    await this.startMotionSources();
    await this.tick();
    this.intervalId = setInterval(() => {
      void this.tick();
    }, TICK_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.tickPending = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    let spinCount = 0;
    while (this.tickInProgress) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
      if (++spinCount > 200) {
        console.warn(
          "[PuppetFlowRuntime] stop() timed out waiting for tick; skipping dispose to avoid races",
        );
        return;
      }
    }

    await this.disposeAdapters();
    await this.disposeSources();
    await this.stopMotionSources();
    this.resetMotionPipeline();
    this.motionOverride.clear();
    this.microBehavior.reset();
    this.statefulStore.reset();
    this.elapsedTime = 0;
    this.frameNumber = 0;
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

  private async initializeAdapters(): Promise<void> {
    const adapters: Array<Adapter | MotionFrameAdapter> = [
      ...this.adapters,
      ...this.motionFrameAdapters,
    ];
    for (const adapter of adapters) {
      if (this.initializedAdapterObjects.has(adapter)) {
        continue;
      }
      this.initializedAdapterObjects.add(adapter);
      try {
        await adapter.initialize();
      } catch (error) {
        console.error(
          `[PuppetFlowRuntime] adapter "${adapter.id}" initialize failed`,
          error,
        );
      }
    }

    this.adaptersInitialized = true;
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
  }

  private async initializeSources(): Promise<void> {
    for (const source of this.sources) {
      try {
        await source.initialize();
      } catch (error) {
        console.error(
          `[PuppetFlowRuntime] source "${source.id}" initialize failed`,
          error,
        );
      }
    }

    this.sourcesInitialized = true;
  }

  private async disposeSources(): Promise<void> {
    for (const source of this.sources) {
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
  }

  private async startMotionSources(): Promise<void> {
    for (const source of this.motionSources) {
      const health = this.motionSourceHealth.get(source.id);
      if (health) {
        health.connected = false;
        health.stale = false;
      }
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
    }
    this.motionSourcesStarted = true;
  }

  private async stopMotionSources(): Promise<void> {
    if (!this.motionSourcesStarted) {
      return;
    }

    for (const source of this.motionSources) {
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
    this.motionSourcesStarted = false;
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

      const sourceTarget = {
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

      for (const source of this.sources) {
        if (!this.running) {
          return;
        }

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
        } catch (error) {
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

    if (inputs.length === 0) {
      return;
    }

    if (this.motionPipeline) {
      try {
        const processed = this.motionPipeline.process(inputs, deltaTime);
        if (processed) {
          await this.updateMotionFrameAdapters(processed, deltaTime);
        }
      } catch (error) {
        console.error("[PuppetFlowRuntime] motion pipeline failed", error);
      }
      return;
    }

    for (const input of inputs) {
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
      } catch (error) {
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
}
