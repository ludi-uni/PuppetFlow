import type { BehaviorBlock } from "@puppetflow/behavior";
import type { PresetExtensions } from "@puppetflow/extension-core";
import type { MotionGraphDocument } from "@puppetflow/motion-graph";
import type { BehaviorPluginConfig } from "./plugin-factory.js";
import type { PuppetFlowPreset } from "./types.js";

export interface PresetParts {
  behavior: BehaviorBlock;
  behaviorPfScript?: string;
  behaviorPlugins: BehaviorPluginConfig[];
  graph: MotionGraphDocument;
  extensions?: PresetExtensions;
}

export function splitPreset(preset: PuppetFlowPreset): PresetParts {
  return {
    behavior: preset.behavior,
    behaviorPfScript: preset.behaviorPfScript,
    behaviorPlugins: preset.behaviorPlugins ?? [],
    graph: preset.graph,
    extensions: preset.extensions,
  };
}

export function assemblePreset(
  base: PuppetFlowPreset,
  parts: Partial<PresetParts>,
): PuppetFlowPreset {
  return {
    ...base,
    behavior: parts.behavior ?? base.behavior,
    behaviorPfScript:
      parts.behaviorPfScript !== undefined
        ? parts.behaviorPfScript
        : base.behaviorPfScript,
    behaviorPlugins: parts.behaviorPlugins ?? base.behaviorPlugins,
    graph: parts.graph ?? base.graph,
    extensions: parts.extensions !== undefined ? parts.extensions : base.extensions,
  };
}
