import { collectBehaviorCustomMotionKeys, parseBehaviorRoot } from "@puppetflow/behavior";
import type { PresetExtensions } from "@puppetflow/extension-core";
import { compilePresetBehavior } from "@puppetflow/preset";
import { getActiveExtensionCustomParameterIds } from "./extension-config.js";

function collectPresetCustomMotionKeys(presetJson: string): string[] {
  try {
    const parsed = JSON.parse(presetJson) as Record<string, unknown>;
    const { behavior } = compilePresetBehavior(parsed);
    return collectBehaviorCustomMotionKeys(behavior);
  } catch {
    try {
      const parsed = JSON.parse(presetJson) as { behavior?: unknown };
      if (parsed.behavior === undefined) {
        return [];
      }
      return collectBehaviorCustomMotionKeys(parseBehaviorRoot(parsed.behavior));
    } catch {
      return [];
    }
  }
}

/** Extension registry + PFScript/behavior custom keys shown in Motion Mapper. */
export function collectMapperCustomParamIds(
  presetJson: string,
  extensionsJson: string,
): string[] {
  const ids = new Set<string>();

  try {
    const extensions = JSON.parse(extensionsJson) as PresetExtensions;
    for (const id of getActiveExtensionCustomParameterIds(extensions)) {
      ids.add(id);
    }
  } catch {
    // ignore invalid extensions JSON
  }

  for (const id of collectPresetCustomMotionKeys(presetJson)) {
    ids.add(id);
  }

  return [...ids].sort();
}
