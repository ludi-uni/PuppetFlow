import type { BehaviorPluginConfig } from "@puppetflow/preset";
import {
  getDefaultPluginConfig,
  getPluginCatalogEntry,
  PLUGIN_CATALOG,
  type CatalogPluginId,
} from "../constants/plugin-catalog";

export interface ParsedPluginEntry {
  id: CatalogPluginId;
  config: Record<string, number>;
}

function isCatalogPluginId(value: string): value is CatalogPluginId {
  return PLUGIN_CATALOG.some((plugin) => plugin.id === value);
}

function normalizeConfig(
  id: CatalogPluginId,
  raw: Record<string, unknown> | undefined,
): Record<string, number> {
  const defaults = getDefaultPluginConfig(id);
  const entry = getPluginCatalogEntry(id);
  const config = { ...defaults };

  if (!raw) {
    return config;
  }

  for (const parameter of entry.parameters) {
    const value = raw[parameter.key];
    if (typeof value === "number" && Number.isFinite(value)) {
      config[parameter.key] = Math.min(parameter.max, Math.max(parameter.min, value));
    }
  }

  return config;
}

export function parseBehaviorPluginEntries(json: string): ParsedPluginEntry[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const entries: ParsedPluginEntry[] = [];

    for (const item of parsed) {
      if (typeof item !== "object" || item === null) {
        continue;
      }

      const plugin = item as Partial<BehaviorPluginConfig>;
      if (typeof plugin.id !== "string" || !isCatalogPluginId(plugin.id)) {
        continue;
      }

      const config =
        typeof plugin.config === "object" && plugin.config !== null
          ? normalizeConfig(plugin.id, plugin.config as Record<string, unknown>)
          : getDefaultPluginConfig(plugin.id);

      entries.push({ id: plugin.id, config });
    }

    return entries;
  } catch {
    return [];
  }
}

export function serializeBehaviorPluginEntries(entries: ParsedPluginEntry[]): string {
  const payload = entries.map((entry) => ({
    id: entry.id,
    config: entry.config,
  }));
  return JSON.stringify(payload, null, 2);
}

export function isPluginEnabled(json: string, id: CatalogPluginId): boolean {
  return parseBehaviorPluginEntries(json).some((entry) => entry.id === id);
}

export function setPluginEnabled(
  json: string,
  id: CatalogPluginId,
  enabled: boolean,
): string {
  const entries = parseBehaviorPluginEntries(json);
  const index = entries.findIndex((entry) => entry.id === id);

  if (enabled && index < 0) {
    entries.push({ id, config: getDefaultPluginConfig(id) });
  }

  if (!enabled && index >= 0) {
    entries.splice(index, 1);
  }

  return serializeBehaviorPluginEntries(entries);
}

export function updatePluginParameter(
  json: string,
  id: CatalogPluginId,
  key: string,
  value: number,
): string {
  const entries = parseBehaviorPluginEntries(json);
  const entry = entries.find((item) => item.id === id);
  if (!entry) {
    return json;
  }

  const parameter = getPluginCatalogEntry(id).parameters.find(
    (item) => item.key === key,
  );
  if (!parameter) {
    return json;
  }

  entry.config[key] = Math.min(parameter.max, Math.max(parameter.min, value));
  return serializeBehaviorPluginEntries(entries);
}

export function mergeBehaviorPluginsIntoPreset(
  presetJson: string,
  behaviorPluginsJson: string,
): string {
  const parsed = JSON.parse(presetJson) as Record<string, unknown>;
  parsed.behaviorPlugins = JSON.parse(behaviorPluginsJson);
  return JSON.stringify(parsed, null, 2);
}
