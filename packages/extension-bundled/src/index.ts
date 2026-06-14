import { clamp01 } from "@puppetflow/core";
import {
  createMotionRegistry,
  registerExtensionPlugins,
  type ExtensionPlugin,
  type MotionRegistry,
  type MotionRegistryImpl,
} from "@puppetflow/extension-core";
import { animalEarsExtensionPlugin } from "@puppetflow/plugin-animal-ears";
import { lookAroundExtensionPlugin } from "@puppetflow/plugin-lookaround";
import { tailExtensionPlugin } from "@puppetflow/plugin-tail";
import { thinkingExtensionPlugin } from "@puppetflow/plugin-thinking";

const heartbeatExtensionPlugin: ExtensionPlugin = {
  id: "heartbeat",
  register(registry: MotionRegistry) {
    registry.addFunction({
      name: "heartbeat",
      label: "Heartbeat",
      description: "体の傾きを脈動させる PFScript 関数",
      execute(ctx, args) {
        const amplitude = args.amplitude ?? 0.15;
        return clamp01(0.5 + Math.sin(ctx.time * Math.PI * 2) * amplitude);
      },
    });

    registry.addNode({
      type: "ext:heartbeat",
      label: "Heartbeat",
      category: "Extension",
      configFields: [
        {
          key: "amplitude",
          label: "Amplitude",
          type: "number",
          default: 0.15,
          min: 0,
          max: 0.5,
        },
      ],
      execute(ctx, data) {
        const amplitude = Number(data.amplitude ?? 0.15);
        const value = clamp01(0.5 + Math.sin(ctx.time * Math.PI * 2) * amplitude);
        return { standard: { bodyLean: value } };
      },
    });
  },
};

const blinkSchedulerExtensionPlugin: ExtensionPlugin = {
  id: "blinkScheduler",
  register(registry: MotionRegistry) {
    registry.addTimelineGenerator({
      id: "blinkScheduler",
      label: "Blink Scheduler",
      description: "タイムラインから瞬きイベントを生成（将来拡張）",
    });
  },
};

export const BUNDLED_EXTENSION_PLUGINS: ExtensionPlugin[] = [
  thinkingExtensionPlugin,
  lookAroundExtensionPlugin,
  tailExtensionPlugin,
  animalEarsExtensionPlugin,
  heartbeatExtensionPlugin,
  blinkSchedulerExtensionPlugin,
];

let cachedRegistry: MotionRegistryImpl | null = null;

export function getBundledMotionRegistry(): MotionRegistryImpl {
  if (!cachedRegistry) {
    cachedRegistry = createMotionRegistry();
    registerExtensionPlugins(cachedRegistry, BUNDLED_EXTENSION_PLUGINS);
  }
  return cachedRegistry;
}

export function resetBundledMotionRegistry(): void {
  cachedRegistry = null;
}

export { collectExtensionCustomParameterIds } from "./collect-custom-parameter-ids.js";
