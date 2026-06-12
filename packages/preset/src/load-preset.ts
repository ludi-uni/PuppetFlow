import { parseBehaviorRoot } from "@puppetflow/behavior";
import type { BehaviorPlugin } from "@puppetflow/core";
import { createModifiers } from "@puppetflow/modifier";
import { DEFAULT_MODIFIER_ORDER } from "@puppetflow/modifier-core";
import type { BehaviorBlock } from "@puppetflow/behavior";
import type { MotionModifier } from "@puppetflow/modifier-core";
import { parseMotionGraph, type MotionGraphDocument } from "@puppetflow/motion-graph";
import {
  createRulePlugin,
  isMotionStateKey,
  type RuleConfig,
} from "@puppetflow/plugin-rule";
import type { PuppetFlowPreset } from "./types.js";
import { createBehaviorPlugins, type BehaviorPluginConfig } from "./plugin-factory.js";

export interface LoadedPreset {
  name: string;
  behavior: BehaviorBlock;
  graph: MotionGraphDocument;
  plugins: BehaviorPlugin[];
  behaviorPlugins: BehaviorPluginConfig[];
  rules: RuleConfig[];
  modifiers: MotionModifier[];
  modifierOrder: readonly string[];
}

function parseRules(raw: unknown): RuleConfig[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const rules: RuleConfig[] = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const rule = entry as Partial<RuleConfig>;
    if (
      typeof rule.input !== "string" ||
      typeof rule.output !== "string" ||
      !isMotionStateKey(rule.output) ||
      typeof rule.gain !== "number"
    ) {
      continue;
    }

    rules.push({
      input: rule.input,
      output: rule.output,
      gain: rule.gain,
    });
  }

  return rules;
}

function parseBehaviorPluginConfigs(raw: unknown): BehaviorPluginConfig[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const entries: BehaviorPluginConfig[] = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const plugin = entry as Partial<BehaviorPluginConfig>;
    if (typeof plugin.id !== "string" || plugin.id.length === 0) {
      continue;
    }

    entries.push({
      id: plugin.id,
      config:
        typeof plugin.config === "object" && plugin.config !== null
          ? (plugin.config as Record<string, unknown>)
          : undefined,
    });
  }

  return entries;
}

function createPlugins(
  rules: RuleConfig[],
  behaviorPlugins: BehaviorPluginConfig[],
): BehaviorPlugin[] {
  const plugins: BehaviorPlugin[] = [];

  if (rules.length > 0) {
    plugins.push(createRulePlugin(rules));
  }

  plugins.push(...createBehaviorPlugins(behaviorPlugins));
  return plugins;
}

export function parsePreset(json: string): PuppetFlowPreset {
  const parsed: unknown = JSON.parse(json);

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Preset must be a JSON object");
  }

  const preset = parsed as Partial<PuppetFlowPreset> & {
    version?: number;
    rules?: unknown;
  };

  if (typeof preset.name !== "string" || preset.name.length === 0) {
    throw new Error("Preset requires a non-empty name");
  }

  if (preset.version !== 2) {
    throw new Error(
      `Unsupported preset version: ${String(preset.version)}. PuppetFlow requires version 2 with behavior and graph.`,
    );
  }

  if ("rules" in preset && !Array.isArray(preset.rules) && preset.rules !== undefined) {
    throw new Error("Preset rules must be an array when provided");
  }

  const rules = parseRules(preset.rules);
  const behaviorPlugins = parseBehaviorPluginConfigs(preset.behaviorPlugins);

  return {
    name: preset.name,
    version: 2,
    behavior: parseBehaviorRoot(preset.behavior),
    graph: parseMotionGraph(preset.graph),
    rules,
    behaviorPlugins,
    modifiers: preset.modifiers ?? [],
    modifierOrder: preset.modifierOrder ?? [...DEFAULT_MODIFIER_ORDER],
  };
}

export function loadPreset(json: string): LoadedPreset {
  const preset = parsePreset(json);

  return {
    name: preset.name,
    behavior: preset.behavior,
    graph: preset.graph,
    plugins: createPlugins(preset.rules ?? [], preset.behaviorPlugins ?? []),
    rules: preset.rules ?? [],
    behaviorPlugins: preset.behaviorPlugins ?? [],
    modifiers: createModifiers(preset.modifiers ?? []),
    modifierOrder: preset.modifierOrder ?? DEFAULT_MODIFIER_ORDER,
  };
}
