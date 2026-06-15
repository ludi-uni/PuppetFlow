import { clamp01 } from "@puppetflow/core";
import type {
  ExtensionContext,
  ExtensionPlugin,
  MotionRegistry,
} from "@puppetflow/extension-core";
import { runStatefulNumber } from "@puppetflow/stateful-core";

function computeEarAngle(ctx: ExtensionContext, intensity: number): number {
  const stateful = runStatefulNumber(ctx, "earPhysics", "earTwitch", { intensity });
  if (stateful !== undefined) {
    return clamp01(stateful);
  }
  return clamp01(
    0.5 + Math.sin(ctx.time * 4.2 + Math.sin(ctx.time * 0.7)) * intensity * 0.35,
  );
}

export const animalEarsExtensionPlugin: ExtensionPlugin = {
  id: "animalEars",
  register(registry: MotionRegistry) {
    registry.addParameter({
      id: "earAngle",
      label: "耳の角度",
      type: "number",
      defaultValue: 0.5,
      min: 0,
      max: 1,
    });

    registry.addPack({
      id: "earTwitch",
      label: "耳ぴくぴく",
      description: "耳パラメータをランダムに揺らす",
      configFields: [
        {
          key: "intensity",
          label: "強さ",
          type: "number",
          default: 0.4,
          min: 0,
          max: 1,
        },
      ],
      execute(ctx, config) {
        const intensity = config.intensity ?? 0.4;
        return { custom: { earAngle: computeEarAngle(ctx, intensity) } };
      },
    });
  },
};
