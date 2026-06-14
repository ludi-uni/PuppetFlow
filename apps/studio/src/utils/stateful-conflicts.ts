import type { BehaviorBlock } from "@puppetflow/behavior";
import {
  detectPresetStageOverlaps,
  formatOverlapWarning,
} from "./preset-warnings.js";

export function findStatefulPluginConflicts(
  behaviorPluginsJson: string,
  behavior: BehaviorBlock,
  graphJson = '{"nodes":[],"edges":[]}',
): string[] {
  return detectPresetStageOverlaps({
    behavior,
    graphJson,
    behaviorPluginsJson,
  }).map((overlap) => formatOverlapWarning(overlap));
}

export function formatStatefulPluginConflictWarning(warnings: string[]): string | null {
  return warnings.length > 0 ? warnings.join("。") : null;
}
