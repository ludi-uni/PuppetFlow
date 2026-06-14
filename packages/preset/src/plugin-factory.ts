import type { BehaviorPlugin } from "@puppetflow/core";
import { AttentionPlugin } from "@puppetflow/plugin-attention";
import { BlinkPlugin } from "@puppetflow/plugin-blink";
import { EmotionPlugin } from "@puppetflow/plugin-emotion";
import { GazePlugin } from "@puppetflow/plugin-gaze";
import { IdlePlugin } from "@puppetflow/plugin-idle";

export interface BehaviorPluginConfig {
  id: string;
  config?: Record<string, unknown>;
}

export type BehaviorPluginFactory = (
  config?: Record<string, unknown>,
) => BehaviorPlugin;

export const BUILTIN_BEHAVIOR_PLUGIN_IDS = [
  "blink",
  "gaze",
  "idle",
  "attention",
  "emotion",
] as const;

export type BuiltinBehaviorPluginId = (typeof BUILTIN_BEHAVIOR_PLUGIN_IDS)[number];

const pluginFactories = new Map<string, BehaviorPluginFactory>();

export function registerBehaviorPlugin(
  id: string,
  factory: BehaviorPluginFactory,
): void {
  pluginFactories.set(id, factory);
}

registerBehaviorPlugin("blink", (config) => new BlinkPlugin(config));
registerBehaviorPlugin("gaze", (config) => new GazePlugin(config));
registerBehaviorPlugin("idle", (config) => new IdlePlugin(config));
registerBehaviorPlugin("attention", (config) => new AttentionPlugin(config));
registerBehaviorPlugin("emotion", (config) => new EmotionPlugin(config));

export function createBehaviorPlugin(entry: BehaviorPluginConfig): BehaviorPlugin {
  const factory = pluginFactories.get(entry.id);
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
