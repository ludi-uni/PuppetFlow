import type { ActingExpressionProfile } from "@puppetflow/runtime";

/**
 * Default expression calibration for the configured VRM.
 *
 * BlendShape names are model-specific calibration data. The semantic acting
 * runtime remains model-agnostic; replace this profile when a different VRM
 * is selected.
 */
export const DEFAULT_EXPRESSION_PROFILE: ActingExpressionProfile = {
  id: "default-vrm-expression",
  expressions: {
    happy: { blendShape: "Warai" },
    sad: { blendShape: "Sorrow" },
    angry: { blendShape: "Angry" },
    relaxed: { blendShape: "Fun" },
    surprised: { blendShape: "Hirameki" },
  },
};
