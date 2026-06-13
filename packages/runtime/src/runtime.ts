import type { Adapter } from "@puppetflow/adapter-core";
import { wrapLegacyAdapter, type LegacyAdapter } from "@puppetflow/adapter-core";
import { executeBehavior, type BehaviorBlock } from "@puppetflow/behavior";
import {
  createEmptyMotionState,
  mergeMotionState,
  TimelineStore,
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
import { executeExtensions, type PresetExtensions } from "@puppetflow/extension-core";
import { getBundledMotionRegistry } from "@puppetflow/extension-bundled";
import type { LoadedPreset } from "@puppetflow/preset";
import type { StateSource } from "@puppetflow/source-core";
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
}) => void;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export class PuppetFlowRuntime {
  readonly state: StateStore = new RuntimeStateStore(() => this.scheduleTick());
  readonly channels: ChannelStore = new RuntimeChannelStore(() => this.scheduleTick());
  readonly timeline: TimelineStore = new TimelineStore();

  private readonly plugins: BehaviorPlugin[] = [];
  private readonly adapters: Adapter[] = [];
  private readonly modifiers: MotionModifier[] = [];
  private readonly sources: StateSource[] = [];
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
  private timelineCurrentMs = 0;
  private activeTimelineEvents: TimelineEvent[] = [];

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private tickPending = false;
  private tickInProgress = false;
  private lastTickTime: number | null = null;
  private adaptersInitialized = false;
  private sourcesInitialized = false;

  use(plugin: BehaviorPlugin): this {
    this.plugins.push(plugin);
    return this;
  }

  /**
   * @deprecated Use `attachAdapter()` instead.
   */
  useAdapter(legacy: LegacyAdapter): this {
    return this.attachAdapter(wrapLegacyAdapter("legacy", legacy));
  }

  attachAdapter(adapter: Adapter): this {
    this.adapters.push(adapter);
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

  getAdapters(): readonly Adapter[] {
    return this.adapters;
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
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    while (this.tickInProgress) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }

    await this.disposeAdapters();
    await this.disposeSources();
  }

  isRunning(): boolean {
    return this.running;
  }

  /** @deprecated Use `getRenderedMotion()` instead. */
  getMotion(): MotionState {
    return this.getRenderedMotion();
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
    for (const adapter of this.adapters) {
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
    for (const adapter of this.adapters) {
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
      this.timelineCurrentMs = Math.floor(this.elapsedTime * 1000);
      this.activeTimelineEvents = this.timeline.getActiveEvents(this.timelineCurrentMs);

      const sourceTarget = {
        state: this.state,
        channels: this.channels,
        timeline: this.timeline,
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
      const pipelineOutputs: PluginOutputSnapshot[] = [];
      const partials: Partial<MotionState>[] = [];

      for (const plugin of this.plugins) {
        try {
          const output = plugin.process(pluginInput, this.renderedMotion);
          pipelineOutputs.push({ pluginId: plugin.id, output });
          partials.push(output);
        } catch (error) {
          console.error(`[PuppetFlowRuntime] plugin "${plugin.id}" failed`, error);
          pipelineOutputs.push({ pluginId: plugin.id, output: {} });
        }
      }

      try {
        const behaviorOutput = executeBehavior(this.behaviorRoot, {
          state: this.state,
          channels: this.channels,
          renderedMotion: this.renderedMotion,
          deltaTime,
        });
        pipelineOutputs.push({ pluginId: "behavior", output: behaviorOutput });
        partials.push(behaviorOutput);
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
        });
        pipelineOutputs.push({ pluginId: "graph", output: graphOutput });
        partials.push(graphOutput);
      } catch (error) {
        console.error("[PuppetFlowRuntime] motion graph execution failed", error);
        pipelineOutputs.push({ pluginId: "graph", output: {} });
      }

      this.pluginOutputs = pipelineOutputs;
      this.targetMotion = mergeMotionState(createEmptyMotionState(), partials);
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
          },
          {
            presetExtensions: this.presetExtensions,
            behavior: this.behaviorRoot,
            graph: this.motionGraph,
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

      for (const adapter of this.adapters) {
        try {
          await adapter.update(this.renderedMotion, deltaTime);
        } catch (error) {
          console.error(
            `[PuppetFlowRuntime] adapter "${adapter.id}" update failed`,
            error,
          );
        }
      }

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
}
