import type { BehaviorBlock } from "@puppetflow/behavior";
import type { PresetExtensions } from "@puppetflow/extension-core";
import type { MotionGraphDocument } from "@puppetflow/motion-graph";
import type { BehaviorPluginConfig } from "./plugin-factory.js";

export interface PuppetFlowPreset {
  name: string;
  version: 3;
  behavior: BehaviorBlock;
  graph: MotionGraphDocument;
  behaviorPlugins?: BehaviorPluginConfig[];
  extensions?: PresetExtensions;
}
