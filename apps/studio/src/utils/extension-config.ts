import type { PresetExtensions } from "@puppetflow/extension-core";
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
}

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
    };
  });
}

export function serializeExtensionPacks(rows: ExtensionPackRow[]): PresetExtensions {
  return {
    packs: rows
      .filter((row) => row.enabled)
      .map((row) => ({ id: row.id, config: row.config })),
  };
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
