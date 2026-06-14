import { useMemo } from "react";
import { resolveNextStep, type NextStepContext } from "../utils/next-step";

export function useStudioNextStep(context: NextStepContext) {
  return useMemo(
    () => resolveNextStep(context),
    [
      context.mapperConfig,
      context.graphJson,
      context.pluginsHaveChanges,
      context.assembledPresetJson,
    ],
  );
}
