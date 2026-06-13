import { parseBehaviorRoot } from "@puppetflow/behavior";
import type { BehaviorPlugin } from "@puppetflow/core";
import type { BehaviorBlock } from "@puppetflow/behavior";
import type { PresetExtensions } from "@puppetflow/extension-core";
import { parseMotionGraph, type MotionGraphDocument } from "@puppetflow/motion-graph";
import type { PuppetFlowPreset } from "./types.js";
import { createBehaviorPlugins, type BehaviorPluginConfig } from "./plugin-factory.js";

export const MAX_PRESET_JSON_BYTES = 1_048_576;

const DEPRECATED_PRESET_FIELDS = ["rules", "modifiers", "modifierOrder"] as const;

export interface LoadedPreset {
  name: string;
  behavior: BehaviorBlock;
  graph: MotionGraphDocument;
  plugins: BehaviorPlugin[];
  behaviorPlugins: BehaviorPluginConfig[];
  extensions?: PresetExtensions;
}

function parseExtensions(raw: unknown): PresetExtensions | undefined {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }

  const ext = raw as PresetExtensions;
  const packs = Array.isArray(ext.packs)
    ? ext.packs
        .filter(
          (entry): entry is { id: string; config?: Record<string, number> } =>
            typeof entry === "object" &&
            entry !== null &&
            typeof (entry as { id?: string }).id === "string",
        )
        .map((entry) => ({
          id: entry.id,
          config: entry.config,
        }))
    : undefined;

  return {
    packs,
    functions: Array.isArray(ext.functions) ? ext.functions : undefined,
    parameterDefaults:
      typeof ext.parameterDefaults === "object" && ext.parameterDefaults !== null
        ? (ext.parameterDefaults as Record<string, number>)
        : undefined,
  };
}

function parseBehaviorPluginConfigs(raw: unknown): BehaviorPluginConfig[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const entries: BehaviorPluginConfig[] = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const plugin = entry as Partial<BehaviorPluginConfig>;
    if (typeof plugin.id !== "string" || plugin.id.length === 0) {
      continue;
    }

    entries.push({
      id: plugin.id,
      config:
        typeof plugin.config === "object" && plugin.config !== null
          ? (plugin.config as Record<string, unknown>)
          : undefined,
    });
  }

  return entries;
}

function rejectDeprecatedPresetFields(preset: Record<string, unknown>): void {
  for (const field of DEPRECATED_PRESET_FIELDS) {
    if (field in preset && preset[field] !== undefined) {
      throw new Error(
        `Preset field "${field}" is no longer supported. Use graph for mappings and behaviorPlugins for gaze/blink/etc.`,
      );
    }
  }
}

export function parsePreset(json: string): PuppetFlowPreset {
  const byteLength = new TextEncoder().encode(json).length;
  if (byteLength > MAX_PRESET_JSON_BYTES) {
    throw new Error(`Preset JSON exceeds max size (${MAX_PRESET_JSON_BYTES} bytes)`);
  }

  const parsed: unknown = JSON.parse(json);

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Preset must be a JSON object");
  }

  const preset = parsed as Partial<PuppetFlowPreset> & Record<string, unknown>;

  if (typeof preset.name !== "string" || preset.name.length === 0) {
    throw new Error("Preset requires a non-empty name");
  }

  if (preset.version !== 3) {
    throw new Error(
      `Unsupported preset version: ${String(preset.version)}. PuppetFlow requires version 3.`,
    );
  }

  rejectDeprecatedPresetFields(preset);

  const behaviorPlugins = parseBehaviorPluginConfigs(preset.behaviorPlugins);

  return {
    name: preset.name,
    version: 3,
    behavior: parseBehaviorRoot(preset.behavior),
    graph: parseMotionGraph(preset.graph),
    behaviorPlugins,
    extensions: parseExtensions(preset.extensions),
  };
}

export function loadPreset(json: string): LoadedPreset {
  const preset = parsePreset(json);

  return {
    name: preset.name,
    behavior: preset.behavior,
    graph: preset.graph,
    plugins: createBehaviorPlugins(preset.behaviorPlugins ?? []),
    behaviorPlugins: preset.behaviorPlugins ?? [],
    extensions: preset.extensions,
  };
}
