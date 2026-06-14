import type { BehaviorBlock } from "@puppetflow/behavior";
import type {
  ChannelStore,
  MotionState,
  StateStore,
  TimelineEvent,
} from "@puppetflow/core";
import type { MotionGraphDocument } from "@puppetflow/motion-graph";

export interface ParameterDefinition {
  id: string;
  label: string;
  type: "number";
  defaultValue: number;
  min?: number;
  max?: number;
}

export interface PackConfigField {
  key: string;
  label: string;
  type: "number";
  default: number;
  min?: number;
  max?: number;
}

export interface MotionPackDefinition {
  id: string;
  label: string;
  description?: string;
  configFields?: PackConfigField[];
  /** Scratch block type id */
  scratchBlockType?: string;
  /** Graph node type id */
  graphNodeType?: string;
  execute: (ctx: ExtensionContext, config: Record<string, number>) => ExtensionOutput;
}

export interface MotionFunctionDefinition {
  name: string;
  label: string;
  description?: string;
  parameters?: PackConfigField[];
  execute: (ctx: ExtensionContext, args: Record<string, number>) => number;
}

export interface MotionNodeDefinition {
  type: string;
  label: string;
  category?: string;
  configFields?: PackConfigField[];
  execute: (
    ctx: ExtensionContext,
    data: Record<string, unknown>,
    inputs: Record<string, number>,
  ) => ExtensionOutput;
}

export interface MotionGeneratorDefinition {
  id: string;
  label: string;
  description?: string;
  configFields?: PackConfigField[];
  outputs: string[];
  execute: (ctx: ExtensionContext, config: Record<string, number>) => ExtensionOutput;
}

export interface TimelineGeneratorDefinition {
  id: string;
  label: string;
  description?: string;
}

export interface ExtensionOutput {
  standard?: Partial<MotionState>;
  custom?: Record<string, number>;
}

export interface ExtensionContext {
  state: StateStore;
  channels: ChannelStore;
  deltaTime: number;
  time: number;
  timelineCurrentMs: number;
  activeTimelineEvents: readonly TimelineEvent[];
  motion: MotionState;
  custom: Readonly<Record<string, number>>;
  statefulStore?: import("@puppetflow/stateful-core").StatefulStore;
  statefulRegistry?: import("@puppetflow/stateful-core").StatefulRegistry;
  frame?: import("@puppetflow/stateful-core").FrameContext;
}

export interface ExtensionPackEntry {
  id: string;
  config?: Record<string, number>;
}

export interface PresetExtensions {
  packs?: ExtensionPackEntry[];
  /** PFScript / graph function invocations stored as named configs */
  functions?: Array<{ name: string; args?: Record<string, number> }>;
  parameterDefaults?: Record<string, number>;
}

export interface ExtensionInvocation {
  kind: "pack" | "generator";
  id: string;
  config: Record<string, number>;
}

export interface ExtensionPlugin {
  id: string;
  register(registry: MotionRegistry): void;
}

export interface MotionRegistry {
  addParameter(def: ParameterDefinition): void;
  addPack(def: MotionPackDefinition): void;
  addFunction(def: MotionFunctionDefinition): void;
  addNode(def: MotionNodeDefinition): void;
  addGenerator(def: MotionGeneratorDefinition): void;
  addTimelineGenerator(def: TimelineGeneratorDefinition): void;
}

export interface ExtensionSources {
  presetExtensions?: PresetExtensions;
  behavior?: BehaviorBlock;
  graph?: MotionGraphDocument;
  /** Runtime-evaluated behavior packs (If-aware). When set, static behavior scan is skipped. */
  behaviorPackInvocations?: ExtensionInvocation[];
}

export interface ResolvedExtensions {
  standard: MotionState;
  custom: Record<string, number>;
  invocations: ExtensionInvocation[];
}
