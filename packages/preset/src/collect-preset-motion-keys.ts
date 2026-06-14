import type { BehaviorBlock, BehaviorStatement } from "@puppetflow/behavior";
import { parseAssignTarget, parseBehaviorRoot } from "@puppetflow/behavior";
import { collectBehaviorCustomMotionKeys } from "@puppetflow/behavior";
import { PLUGIN_MOTION_OUTPUTS } from "@puppetflow/core";
import type { MotionGraphDocument } from "@puppetflow/motion-graph";
import type { BehaviorPluginConfig } from "./plugin-factory.js";

export interface PresetOverlapWarning {
  motionKey: string;
  sources: string[];
}
import {
  compilePresetBehavior,
  type PresetBehaviorSource,
} from "./compile-behavior.js";

/** Normalizes ExprAssign / Assign targets for overlap reporting. */
export function formatBehaviorMotionKey(target: string): string {
  const resolved = parseAssignTarget(target);
  if (typeof resolved === "string") {
    return resolved;
  }
  return `custom:${resolved.custom}`;
}

function collectFromStatements(statements: BehaviorStatement[], keys: Set<string>): void {
  for (const statement of statements) {
    switch (statement.type) {
      case "Block":
        collectFromStatements(statement.statements, keys);
        break;
      case "If":
        collectFromStatements(statement.then, keys);
        if (statement.else) {
          collectFromStatements(statement.else, keys);
        }
        break;
      case "Assign":
        keys.add(statement.key);
        break;
      case "ExprAssign":
        keys.add(formatBehaviorMotionKey(statement.target));
        break;
      default:
        break;
    }
  }
}

/** Standard + custom keys written by Behavior AST (Assign / ExprAssign). */
export function collectBehaviorMotionKeys(block: BehaviorBlock): string[] {
  const keys = new Set<string>();
  collectFromStatements(block.statements, keys);
  return [...keys].sort();
}

export { collectBehaviorCustomMotionKeys };

export function collectGraphMotionKeys(graph: MotionGraphDocument): string[] {
  const keys = new Set<string>();
  for (const node of graph.nodes) {
    if (node.type === "output" && typeof node.data.key === "string") {
      keys.add(node.data.key);
    }
  }
  return [...keys].sort();
}

export function collectPluginMotionKeys(
  plugins: BehaviorPluginConfig[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const plugin of plugins) {
    const outputs = PLUGIN_MOTION_OUTPUTS[plugin.id];
    if (!outputs) {
      continue;
    }

    for (const key of outputs) {
      const list = map.get(key) ?? [];
      list.push(`plugin:${plugin.id}`);
      map.set(key, list);
    }
  }

  return map;
}

export interface PresetMotionKeyEntry {
  motionKey: string;
  sources: string[];
}

/** All motion keys produced by behavior / graph / behaviorPlugins with source labels. */
export function collectPresetMotionKeys(input: {
  behavior: BehaviorBlock;
  graph: MotionGraphDocument;
  behaviorPlugins?: BehaviorPluginConfig[];
}): PresetMotionKeyEntry[] {
  const sources = new Map<string, string[]>();

  const add = (key: string, source: string) => {
    const list = sources.get(key) ?? [];
    list.push(source);
    sources.set(key, list);
  };

  for (const [key, pluginSources] of collectPluginMotionKeys(input.behaviorPlugins ?? [])) {
    for (const source of pluginSources) {
      add(key, source);
    }
  }

  for (const key of collectGraphMotionKeys(input.graph)) {
    add(key, "graph");
  }

  for (const key of collectBehaviorMotionKeys(input.behavior)) {
    add(key, "behavior");
  }

  return [...sources.entries()]
    .map(([motionKey, keySources]) => ({ motionKey, sources: [...keySources] }))
    .sort((a, b) => a.motionKey.localeCompare(b.motionKey));
}

function shouldWarnOverlappingSources(motionKey: string, sources: string[]): boolean {
  if (sources.length < 2) {
    return false;
  }

  if (isLayeredPluginBehaviorOverlap(motionKey, sources)) {
    return false;
  }

  const hasGraph = sources.includes("graph");
  const hasBehavior = sources.includes("behavior");
  const hasPlugin = sources.some((source) => source.startsWith("plugin:"));
  const pluginSources = sources.filter((source) => source.startsWith("plugin:"));

  if (pluginSources.length >= 2) {
    return true;
  }

  return (
    (hasGraph && hasPlugin) ||
    (hasBehavior && hasPlugin) ||
    (hasGraph && hasBehavior)
  );
}

/** PFScript baseline + blink overlay compose via runtime addMotionState. */
function isLayeredPluginBehaviorOverlap(motionKey: string, sources: string[]): boolean {
  if (motionKey !== "eyeYaw" || !sources.includes("behavior")) {
    return false;
  }
  const pluginSources = sources.filter((source) => source.startsWith("plugin:"));
  return (
    pluginSources.length === 1 &&
    pluginSources[0] === "plugin:blink" &&
    sources.length === 2
  );
}

/** Detects motion keys written by multiple pipeline stages (plugins / graph / behavior). */
export function detectPresetMotionOverlaps(input: {
  behavior: BehaviorBlock;
  graph: MotionGraphDocument;
  behaviorPlugins?: BehaviorPluginConfig[];
}): PresetOverlapWarning[] {
  const warnings: PresetOverlapWarning[] = [];

  for (const entry of collectPresetMotionKeys(input)) {
    if (!shouldWarnOverlappingSources(entry.motionKey, entry.sources)) {
      continue;
    }
    warnings.push({ motionKey: entry.motionKey, sources: [...entry.sources] });
  }

  return warnings;
}

/** PFScript / behavior custom keys from preset JSON (compiled behavior preferred). */
export function collectPresetCustomMotionKeysFromSource(
  source: PresetBehaviorSource,
): string[] {
  try {
    const { behavior } = compilePresetBehavior(source);
    return collectBehaviorCustomMotionKeys(behavior);
  } catch {
    if (source.behavior === undefined) {
      return [];
    }
    try {
      return collectBehaviorCustomMotionKeys(parseBehaviorRoot(source.behavior));
    } catch {
      return [];
    }
  }
}

export function collectPresetCustomMotionKeysFromJson(presetJson: string): string[] {
  try {
    const parsed = JSON.parse(presetJson) as PresetBehaviorSource;
    return collectPresetCustomMotionKeysFromSource(parsed);
  } catch {
    return [];
  }
}
