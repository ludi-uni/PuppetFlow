import { clamp01 } from "@puppetflow/core";
import type { ExtensionContext, ExtensionPlugin, MotionRegistry } from "@puppetflow/extension-core";
import { runStatefulNumber } from "@puppetflow/stateful-core";

function lookAroundMotion(ctx: ExtensionContext, intensity: number) {
  const wanderSpeed = 0.3 + intensity * 0.2;
  const wanderX = runStatefulNumber(ctx, "wander", "lookAround:x", { speed: wanderSpeed });
  const wanderY = runStatefulNumber(ctx, "wander", "lookAround:y", { speed: wanderSpeed * 0.85 });
  const oscTilt = runStatefulNumber(ctx, "oscillator", "lookAround:tilt", {
    frequency: 0.3 + intensity * 0.2,
  });

  const phase = ctx.time * (0.6 + intensity * 0.4);
  return {
    lookX:
      wanderX !== undefined
        ? clamp01(0.5 + wanderX * intensity * 0.25)
        : clamp01(0.5 + Math.sin(phase) * intensity * 0.25),
    lookY:
      wanderY !== undefined
        ? clamp01(0.5 + wanderY * intensity * 0.18)
        : clamp01(0.5 + Math.cos(phase * 0.7) * intensity * 0.18),
    headTilt:
      oscTilt !== undefined
        ? clamp01(0.5 + oscTilt * intensity * 0.1)
        : clamp01(0.5 + Math.sin(phase * 0.5) * intensity * 0.1),
  };
}

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
        return { standard: lookAroundMotion(ctx, intensity) };
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
        return { standard: lookAroundMotion(ctx, intensity) };
      },
    });
  },
};
