import { clamp01 } from "@puppetflow/core";
import type { ExtensionPlugin, MotionRegistry } from "@puppetflow/extension-core";

export const thinkingExtensionPlugin: ExtensionPlugin = {
  id: "thinking",
  register(registry: MotionRegistry) {
    registry.addPack({
      id: "thinking",
      label: "考え込む",
      description: "視線を逸らし、首を傾げた考え中の動き",
      scratchBlockType: "pf_motion_pack_thinking",
      graphNodeType: "motionPack",
      configFields: [
        {
          key: "intensity",
          label: "強さ",
          type: "number",
          default: 0.8,
          min: 0,
          max: 1,
        },
      ],
      execute(ctx, config) {
        const intensity = config.intensity ?? 0.8;
        const phase = ctx.time * 0.4;
        return {
          standard: {
            lookX: clamp01(0.5 - intensity * 0.18 + Math.sin(phase) * 0.04),
            lookY: clamp01(0.5 + intensity * 0.08),
            headTilt: clamp01(0.5 + intensity * 0.12),
            facePitch: clamp01(0.5 - intensity * 0.04),
          },
        };
      },
    });
  },
};
