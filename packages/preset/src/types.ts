import type { BehaviorBlock } from "@puppetflow/behavior";
import type { PresetExtensions } from "@puppetflow/extension-core";
import type { MotionGraphDocument } from "@puppetflow/motion-graph";
import type { BehaviorPluginConfig } from "./plugin-factory.js";

export interface PuppetFlowPreset {
  name: string;
  version: 3;
  /** Compiled Behavior AST. Omitted in source JSON when `behaviorPfScript` is provided. */
  behavior: BehaviorBlock;
  /** Optional PFScript source. When present, load compiles this over cached `behavior`. */
  behaviorPfScript?: string;
  graph: MotionGraphDocument;
  behaviorPlugins?: BehaviorPluginConfig[];
  extensions?: PresetExtensions;
}
