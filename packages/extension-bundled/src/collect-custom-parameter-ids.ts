import type { PresetExtensions } from "@puppetflow/extension-core";
import { getBundledMotionRegistry } from "./index.js";

/** Which custom registry parameters are driven by which packs. */
const CUSTOM_PARAM_PACKS: Record<string, string[]> = {
  tailWag: ["tailWag"],
  earAngle: ["earTwitch"],
};

/** Extension `parameterDefaults` keys that should appear in Motion Mapper. */
export function collectExtensionCustomParameterIds(
  extensions: PresetExtensions | undefined,
): string[] {
  const registry = getBundledMotionRegistry();
  const enabledPackIds = new Set((extensions?.packs ?? []).map((pack) => pack.id));
  const ids = new Set<string>();

  for (const definition of registry.parameters.values()) {
    const relatedPackIds = CUSTOM_PARAM_PACKS[definition.id] ?? [];
    const packDriving =
      relatedPackIds.length > 0 &&
      relatedPackIds.some((packId) => enabledPackIds.has(packId));
    const active = relatedPackIds.length === 0 || !packDriving;
    if (active) {
      ids.add(definition.id);
    }
  }

  for (const key of Object.keys(extensions?.parameterDefaults ?? {})) {
    ids.add(key);
  }

  return [...ids].sort();
}
