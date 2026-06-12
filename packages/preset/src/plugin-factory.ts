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

export function createBehaviorPlugin(entry: BehaviorPluginConfig): BehaviorPlugin {
  switch (entry.id) {
    case "blink":
      return new BlinkPlugin(entry.config);
    case "gaze":
      return new GazePlugin(entry.config);
    case "idle":
      return new IdlePlugin(entry.config);
    case "attention":
      return new AttentionPlugin(entry.config);
    case "emotion":
      return new EmotionPlugin(entry.config);
    default:
      throw new Error(`Unknown behavior plugin id: ${entry.id}`);
  }
}

export function createBehaviorPlugins(
  entries: BehaviorPluginConfig[],
): BehaviorPlugin[] {
  return entries.map((entry) => createBehaviorPlugin(entry));
}
