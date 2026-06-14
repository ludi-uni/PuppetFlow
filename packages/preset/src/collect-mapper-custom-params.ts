import type { PresetExtensions } from "@puppetflow/extension-core";
import { collectExtensionCustomParameterIds } from "@puppetflow/extension-bundled";
import { collectPresetCustomMotionKeysFromJson } from "./collect-preset-motion-keys.js";

/** PFScript/behavior custom keys + Extension custom parameters for Motion Mapper. */
export function collectMapperCustomParamIds(
  presetJson: string,
  extensions?: PresetExtensions,
): string[] {
  const ids = new Set<string>();

  for (const id of collectPresetCustomMotionKeysFromJson(presetJson)) {
    ids.add(id);
  }
  for (const id of collectExtensionCustomParameterIds(extensions)) {
    ids.add(id);
  }

  return [...ids].sort();
}

export function collectMapperCustomParamIdsFromParts(
  presetJson: string,
  extensionsJson: string,
): string[] {
  let extensions: PresetExtensions | undefined;
  try {
    extensions = JSON.parse(extensionsJson) as PresetExtensions;
  } catch {
    extensions = undefined;
  }
  return collectMapperCustomParamIds(presetJson, extensions);
}
