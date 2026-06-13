import { clamp01 } from "@puppetflow/core";
import type { ExtensionPlugin, MotionRegistry } from "@puppetflow/extension-core";

export const lookAroundExtensionPlugin: ExtensionPlugin = {
  id: "lookAround",
  register(registry: MotionRegistry) {
    registry.addGenerator({
      id: "lookAround",
      label: "視線探索",
      description: "周囲を見回す視線と首の動き",
      configFields: [
        {
          key: "intensity",
          label: "強さ",
          type: "number",
          default: 0.5,
          min: 0,
          max: 1,
        },
      ],
      outputs: ["lookX", "lookY", "headTilt"],
      execute(ctx, config) {
        const intensity = config.intensity ?? 0.5;
        const phase = ctx.time * (0.6 + intensity * 0.4);
        return {
          standard: {
            lookX: clamp01(0.5 + Math.sin(phase) * intensity * 0.25),
            lookY: clamp01(0.5 + Math.cos(phase * 0.7) * intensity * 0.18),
            headTilt: clamp01(0.5 + Math.sin(phase * 0.5) * intensity * 0.1),
          },
        };
      },
    });

    registry.addPack({
      id: "lookAround",
      label: "視線探索",
      description: "周囲を見回す",
      graphNodeType: "motionGenerator",
      configFields: [
        {
          key: "intensity",
          label: "強さ",
          type: "number",
          default: 0.5,
          min: 0,
          max: 1,
        },
      ],
      execute(ctx, config) {
        const intensity = config.intensity ?? 0.5;
        const phase = ctx.time * (0.6 + intensity * 0.4);
        return {
          standard: {
            lookX: clamp01(0.5 + Math.sin(phase) * intensity * 0.25),
            lookY: clamp01(0.5 + Math.cos(phase * 0.7) * intensity * 0.18),
            headTilt: clamp01(0.5 + Math.sin(phase * 0.5) * intensity * 0.1),
          },
        };
      },
    });
  },
};
