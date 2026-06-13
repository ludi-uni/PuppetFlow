import { AttentionPlugin } from "@puppetflow/plugin-attention";
import { BlinkPlugin } from "@puppetflow/plugin-blink";
import { EmotionPlugin } from "@puppetflow/plugin-emotion";
import { GazePlugin } from "@puppetflow/plugin-gaze";
import { IdlePlugin } from "@puppetflow/plugin-idle";
import { registerBehaviorPlugin } from "./plugin-registry.js";

registerBehaviorPlugin("blink", (config) => new BlinkPlugin(config));
registerBehaviorPlugin("gaze", (config) => new GazePlugin(config));
registerBehaviorPlugin("idle", (config) => new IdlePlugin(config));
registerBehaviorPlugin("attention", (config) => new AttentionPlugin(config));
registerBehaviorPlugin("emotion", (config) => new EmotionPlugin(config));
