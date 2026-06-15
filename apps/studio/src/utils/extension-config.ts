import type { MotionStateKey } from "@puppetflow/core";
import type { PresetExtensions } from "@puppetflow/extension-core";
import { collectExtensionCustomParameterIds } from "@puppetflow/extension-bundled";
import { getBundledMotionRegistry } from "@puppetflow/extension-bundled";

export interface ExtensionPackRow {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  config: Record<string, number>;
  configFields: Array<{
    key: string;
    label: string;
    min: number;
    max: number;
    step: number;
    default: number;
  }>;
  standardOutputs: MotionStateKey[];
  customOutputs: string[];
}

export interface ExtensionCustomParameterRow {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Shown when a related Motion Pack is enabled */
  active: boolean;
  relatedPackIds: string[];
}

/** Which custom registry parameters are driven by which packs */
const CUSTOM_PARAM_PACKS: Record<string, string[]> = {
  tailWag: ["tailWag"],
  earAngle: ["earTwitch"],
};

const PACK_STANDARD_OUTPUTS: Record<string, MotionStateKey[]> = {
  thinking: ["lookX", "lookY", "headTilt", "facePitch"],
  lookAround: ["lookX", "lookY", "headTilt"],
};

const PACK_CUSTOM_OUTPUTS: Record<string, string[]> = {
  tailWag: ["tailWag"],
  earTwitch: ["earAngle"],
};

export function listExtensionCatalog() {
  const registry = getBundledMotionRegistry();
  return {
    packs: [...registry.packs.values()],
    generators: [...registry.generators.values()],
    parameters: [...registry.parameters.values()],
    functions: [...registry.functions.values()],
    nodes: [...registry.nodes.values()],
  };
}

export function parseExtensionPackRows(
  extensions: PresetExtensions | undefined,
): ExtensionPackRow[] {
  const registry = getBundledMotionRegistry();
  const enabledMap = new Map(
    (extensions?.packs ?? []).map((pack) => [pack.id, pack.config ?? {}]),
  );

  return [...registry.packs.values()].map((pack) => {
    const enabled = enabledMap.has(pack.id);
    const config: Record<string, number> = {};
    for (const field of pack.configFields ?? []) {
      config[field.key] = enabledMap.get(pack.id)?.[field.key] ?? field.default;
    }
    return {
      id: pack.id,
      label: pack.label,
      description: pack.description ?? "",
      enabled,
      config,
      configFields: (pack.configFields ?? []).map((field) => ({
        key: field.key,
        label: field.label,
        min: field.min ?? 0,
        max: field.max ?? 1,
        step: 0.05,
        default: field.default,
      })),
      standardOutputs: PACK_STANDARD_OUTPUTS[pack.id] ?? [],
      customOutputs: PACK_CUSTOM_OUTPUTS[pack.id] ?? [],
    };
  });
}

export function parseExtensionCustomParameterRows(
  extensions: PresetExtensions | undefined,
  enabledPackIds: readonly string[],
): ExtensionCustomParameterRow[] {
  const registry = getBundledMotionRegistry();
  const defaults = extensions?.parameterDefaults ?? {};
  const enabledSet = new Set(enabledPackIds);

  return [...registry.parameters.values()].map((def) => {
    const relatedPackIds = CUSTOM_PARAM_PACKS[def.id] ?? [];
    const packDriving =
      relatedPackIds.length > 0 &&
      relatedPackIds.some((packId) => enabledSet.has(packId));
    const active = relatedPackIds.length === 0 || !packDriving;
    return {
      id: def.id,
      label: def.label,
      value: defaults[def.id] ?? def.defaultValue,
      min: def.min ?? 0,
      max: def.max ?? 1,
      step: 0.05,
      active,
      relatedPackIds,
    };
  });
}

export function getActiveExtensionCustomParameterIds(
  extensions: PresetExtensions | undefined,
): string[] {
  return collectExtensionCustomParameterIds(extensions);
}

export function serializeExtensions(
  packRows: ExtensionPackRow[],
  customRows: ExtensionCustomParameterRow[],
): PresetExtensions {
  const parameterDefaults: Record<string, number> = {};

  for (const row of customRows) {
    if (!row.active) {
      continue;
    }
    parameterDefaults[row.id] = row.value;
  }

  return {
    packs: packRows
      .filter((row) => row.enabled)
      .map((row) => ({ id: row.id, config: row.config })),
    ...(Object.keys(parameterDefaults).length > 0 ? { parameterDefaults } : {}),
  };
}

/** @deprecated Use serializeExtensions */
export function serializeExtensionPacks(rows: ExtensionPackRow[]): PresetExtensions {
  return serializeExtensions(rows, []);
}

export function extractExtensionsJson(presetJson: string): string {
  try {
    const parsed = JSON.parse(presetJson) as { extensions?: PresetExtensions };
    return JSON.stringify(parsed.extensions ?? { packs: [] }, null, 2);
  } catch {
    return JSON.stringify({ packs: [] }, null, 2);
  }
}

export function mergeExtensionsPart(
  presetJson: string,
  extensionsJson: string,
): string {
  const parsed = JSON.parse(presetJson) as Record<string, unknown>;
  parsed.extensions = JSON.parse(extensionsJson);
  return JSON.stringify(parsed, null, 2);
}

export function formatExtensionPackOutputs(row: ExtensionPackRow): string {
  const parts: string[] = [];
  if (row.standardOutputs.length > 0) {
    parts.push(row.standardOutputs.join(", "));
  }
  for (const customKey of row.customOutputs) {
    parts.push(`custom.${customKey}`);
  }
  return parts.join(", ");
}
