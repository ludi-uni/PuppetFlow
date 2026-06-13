import type { BehaviorPlugin } from "@puppetflow/core";
import "./builtin-behavior-plugins.js";
import { getBehaviorPluginFactory } from "./plugin-registry.js";

export interface BehaviorPluginConfig {
  id: string;
  config?: Record<string, unknown>;
}

export function createBehaviorPlugin(entry: BehaviorPluginConfig): BehaviorPlugin {
  const factory = getBehaviorPluginFactory(entry.id);
  if (!factory) {
    throw new Error(`Unknown behavior plugin id: ${entry.id}`);
  }
  return factory(entry.config);
}

export function createBehaviorPlugins(
  entries: BehaviorPluginConfig[],
): BehaviorPlugin[] {
  return entries.map((entry) => createBehaviorPlugin(entry));
}
