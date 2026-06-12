import type { BehaviorBlock } from "@puppetflow/behavior";
import type { ModifierConfigEntry } from "@puppetflow/modifier";
import type { MotionGraphDocument } from "@puppetflow/motion-graph";
import type { RuleConfig } from "@puppetflow/plugin-rule";
import type { BehaviorPluginConfig } from "./plugin-factory.js";

export interface PuppetFlowPreset {
  name: string;
  version: 2;
  behavior: BehaviorBlock;
  graph: MotionGraphDocument;
  rules?: RuleConfig[];
  behaviorPlugins?: BehaviorPluginConfig[];
  modifiers?: ModifierConfigEntry[];
  modifierOrder?: string[];
}
