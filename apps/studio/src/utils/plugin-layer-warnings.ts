import { parseBehaviorRoot, type BehaviorBlock } from "@puppetflow/behavior";
import {
  LEGACY_BEHAVIOR_PLUGIN_IDS,
  OFFICIAL_BEHAVIOR_PLUGIN_IDS,
} from "@puppetflow/core";
import {
  detectPresetStageOverlaps,
  formatOverlapWarnings,
  parseBehaviorPluginsJson,
} from "./preset-warnings.js";
import { tryCompilePfScriptSource, type PfScriptCompileResult } from "./pfscript-preset.js";
import { extractBehaviorPluginsJson, extractGraphJson } from "./preset-parts.js";

export {
  OFFICIAL_BEHAVIOR_PLUGIN_IDS,
  LEGACY_BEHAVIOR_PLUGIN_IDS,
} from "@puppetflow/core";

export function parseEnabledPluginIds(behaviorPluginsJson: string): string[] {
  return parseBehaviorPluginsJson(behaviorPluginsJson).map((entry) => entry.id);
}

export function formatLegacyPluginHint(enabledPluginIds: string[]): string | null {
  const legacy = enabledPluginIds.filter((id) =>
    (LEGACY_BEHAVIOR_PLUGIN_IDS as readonly string[]).includes(id),
  );
  if (legacy.length === 0) {
    return null;
  }
  return `レガシープラグイン（${legacy.join(", ")}）が有効です。公式 preset は blink + idle を推奨します。gaze の代わりに PFScript の wander() や Scratch の「ランダムに視線移動」を検討してください。`;
}

function isPfScriptCompileResult(
  result: PfScriptCompileResult | { message: string },
): result is PfScriptCompileResult {
  return "behavior" in result;
}

function resolveBehaviorFromPreset(
  presetJson: string,
  pfScriptDraft?: string,
): BehaviorBlock | null {
  if (pfScriptDraft !== undefined) {
    const compiled = tryCompilePfScriptSource(pfScriptDraft);
    return isPfScriptCompileResult(compiled) ? compiled.behavior : null;
  }

  try {
    const parsed = JSON.parse(presetJson) as {
      behaviorPfScript?: string;
      behavior?: unknown;
    };
    if (typeof parsed.behaviorPfScript === "string" && parsed.behaviorPfScript.trim()) {
      const compiled = tryCompilePfScriptSource(parsed.behaviorPfScript);
      if (isPfScriptCompileResult(compiled)) {
        return compiled.behavior;
      }
    }
    if (parsed.behavior !== undefined) {
      return parseBehaviorRoot(parsed.behavior);
    }
  } catch {
    return null;
  }

  return null;
}

export function collectPluginLayerOverlapWarning(input: {
  presetJson: string;
  graphJson?: string;
  behaviorPluginsJson?: string;
  pfScriptDraft?: string;
}): string | null {
  const behavior = resolveBehaviorFromPreset(input.presetJson, input.pfScriptDraft);
  if (!behavior) {
    return null;
  }

  return formatOverlapWarnings(
    detectPresetStageOverlaps({
      behavior,
      graphJson: input.graphJson ?? extractGraphJson(input.presetJson),
      behaviorPluginsJson:
        input.behaviorPluginsJson ?? extractBehaviorPluginsJson(input.presetJson),
    }),
  );
}

export function collectPluginLayerGuidance(input: {
  presetJson: string;
  graphJson?: string;
  behaviorPluginsJson?: string;
  pfScriptDraft?: string;
}): string | null {
  const behaviorPluginsJson =
    input.behaviorPluginsJson ?? extractBehaviorPluginsJson(input.presetJson);
  const hints = [
    formatLegacyPluginHint(parseEnabledPluginIds(behaviorPluginsJson)),
    collectPluginLayerOverlapWarning(input),
  ].filter((message): message is string => message !== null);

  return hints.length > 0 ? hints.join(" ") : null;
}
