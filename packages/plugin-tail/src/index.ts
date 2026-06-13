import { clamp01 } from "@puppetflow/core";
import type { ExtensionPlugin, MotionRegistry } from "@puppetflow/extension-core";

export const tailExtensionPlugin: ExtensionPlugin = {
  id: "tail",
  register(registry: MotionRegistry) {
    registry.addParameter({
      id: "tailWag",
      label: "尻尾の振り",
      type: "number",
      defaultValue: 0,
      min: 0,
      max: 1,
    });

    registry.addPack({
      id: "tailWag",
      label: "尻尾を振る",
      description: "尻尾パラメータを oscillate させる",
      configFields: [
        {
          key: "intensity",
          label: "強さ",
          type: "number",
          default: 0.7,
          min: 0,
          max: 1,
        },
      ],
      execute(ctx, config) {
        const intensity = config.intensity ?? 0.7;
        const wag = clamp01(
          0.5 + Math.sin(ctx.time * (2 + intensity)) * intensity * 0.5,
        );
        return { custom: { tailWag: wag } };
      },
    });

    registry.addFunction({
      name: "tailWag",
      label: "尻尾の振り関数",
      execute(ctx, args) {
        const intensity = args.intensity ?? 0.7;
        return clamp01(0.5 + Math.sin(ctx.time * 3) * intensity * 0.5);
      },
    });
  },
};
