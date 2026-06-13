import type { BehaviorBlock, BehaviorStatement } from "@puppetflow/behavior";
import { PLUGIN_MOTION_OUTPUTS } from "@puppetflow/core";
import type { MotionGraphDocument } from "@puppetflow/motion-graph";
import type { BehaviorPluginConfig } from "./plugin-factory.js";

export interface PresetOverlapWarning {
  motionKey: string;
  sources: string[];
}

function collectBehaviorMotionKeys(block: BehaviorBlock, keys: Set<string>): void {
  for (const statement of block.statements) {
    collectStatementMotionKeys(statement, keys);
  }
}

function collectStatementMotionKeys(statement: BehaviorStatement, keys: Set<string>): void {
  switch (statement.type) {
    case "Block":
      collectBehaviorMotionKeys(statement, keys);
      break;
    case "If":
      collectBehaviorMotionKeys({ type: "Block", statements: statement.then }, keys);
      if (statement.else) {
        collectBehaviorMotionKeys({ type: "Block", statements: statement.else }, keys);
      }
      break;
    case "Assign":
      keys.add(statement.key);
      break;
    default:
      break;
  }
}

function collectGraphMotionKeys(graph: MotionGraphDocument): Set<string> {
  const keys = new Set<string>();
  for (const node of graph.nodes) {
    if (node.type === "output" && typeof node.data.key === "string") {
      keys.add(node.data.key);
    }
  }
  return keys;
}

function collectPluginMotionKeys(plugins: BehaviorPluginConfig[]): Map<string, string[]> {
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

/** Detects motion keys written by multiple pipeline stages (plugins / graph / behavior). */
export function detectPresetMotionOverlaps(input: {
  behavior: BehaviorBlock;
  graph: MotionGraphDocument;
  behaviorPlugins?: BehaviorPluginConfig[];
}): PresetOverlapWarning[] {
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

  const behaviorKeys = new Set<string>();
  collectBehaviorMotionKeys(input.behavior, behaviorKeys);
  for (const key of behaviorKeys) {
    add(key, "behavior");
  }

  const warnings: PresetOverlapWarning[] = [];
  for (const [motionKey, keySources] of sources) {
    if (!shouldWarnOverlappingSources(keySources)) {
      continue;
    }
    warnings.push({ motionKey, sources: [...keySources] });
  }

  return warnings.sort((a, b) => a.motionKey.localeCompare(b.motionKey));
}

function shouldWarnOverlappingSources(sources: string[]): boolean {
  if (sources.length < 2) {
    return false;
  }

  const hasGraph = sources.includes("graph");
  const hasBehavior = sources.includes("behavior");
  const hasPlugin = sources.some((source) => source.startsWith("plugin:"));

  return (
    (hasGraph && hasPlugin) ||
    (hasBehavior && hasPlugin) ||
    (hasGraph && hasBehavior)
  );
}
