import type { BehaviorBlock } from "@puppetflow/behavior";
import type { BehaviorPlugin } from "@puppetflow/core";
import type { PresetExtensions } from "@puppetflow/extension-core";
import { parseMotionGraph, type MotionGraphDocument } from "@puppetflow/motion-graph";
import type { PuppetFlowPreset } from "./types.js";
import { compilePresetBehavior } from "./compile-behavior.js";
import { migratePresetMotionKeys } from "./migrate-preset-motion-keys.js";
import { createBehaviorPlugins, type BehaviorPluginConfig } from "./plugin-factory.js";
import { detectPresetMotionOverlaps } from "./preset-overlap.js";

export const MAX_PRESET_JSON_BYTES = 1_048_576;

const DEPRECATED_PRESET_FIELDS = ["rules", "modifiers", "modifierOrder"] as const;

export interface LoadedPreset {
  name: string;
  behavior: BehaviorBlock;
  graph: MotionGraphDocument;
  plugins: BehaviorPlugin[];
  behaviorPlugins: BehaviorPluginConfig[];
  behaviorPfScript?: string;
  extensions?: PresetExtensions;
  warnings: string[];
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

function collectPresetWarnings(
  behavior: BehaviorBlock,
  graph: MotionGraphDocument,
  behaviorPlugins: BehaviorPluginConfig[],
  migrationWarnings: string[],
): string[] {
  const warnings = [...migrationWarnings];

  for (const overlap of detectPresetMotionOverlaps({ behavior, graph, behaviorPlugins })) {
    warnings.push(
      `motion key "${overlap.motionKey}" is produced by multiple stages: ${overlap.sources.join(", ")}`,
    );
  }

  return warnings;
}

function resolveBehavior(preset: Record<string, unknown>): {
  behavior: BehaviorBlock;
  behaviorPfScript?: string;
} {
  return compilePresetBehavior({
    behavior: preset.behavior,
    behaviorPfScript: preset.behaviorPfScript,
  });
}

function parsePresetRecord(
  preset: Partial<PuppetFlowPreset> & Record<string, unknown>,
): { preset: PuppetFlowPreset; migrationWarnings: string[] } {
  if (typeof preset.name !== "string" || preset.name.length === 0) {
    throw new Error("Preset requires a non-empty name");
  }

  if (preset.version !== 3) {
    throw new Error(
      `Unsupported preset version: ${String(preset.version)}. PuppetFlow requires version 3.`,
    );
  }

  rejectDeprecatedPresetFields(preset);

  const migrationWarnings = migratePresetMotionKeys(preset);

  const behaviorPlugins = parseBehaviorPluginConfigs(preset.behaviorPlugins);
  const { behavior, behaviorPfScript } = resolveBehavior(preset);

  return {
    preset: {
      name: preset.name,
      version: 3,
      behavior,
      behaviorPfScript,
      graph: parseMotionGraph(preset.graph),
      behaviorPlugins,
      extensions: parseExtensions(preset.extensions),
    },
    migrationWarnings,
  };
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

  return parsePresetRecord(
    parsed as Partial<PuppetFlowPreset> & Record<string, unknown>,
  ).preset;
}

export function loadPreset(json: string): LoadedPreset {
  const byteLength = new TextEncoder().encode(json).length;
  if (byteLength > MAX_PRESET_JSON_BYTES) {
    throw new Error(`Preset JSON exceeds max size (${MAX_PRESET_JSON_BYTES} bytes)`);
  }

  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Preset must be a JSON object");
  }

  const { preset, migrationWarnings } = parsePresetRecord(
    parsed as Partial<PuppetFlowPreset> & Record<string, unknown>,
  );
  const behaviorPlugins = preset.behaviorPlugins ?? [];
  const warnings = collectPresetWarnings(
    preset.behavior,
    preset.graph,
    behaviorPlugins,
    migrationWarnings,
  );

  for (const warning of warnings) {
    console.warn(`[PuppetFlowPreset] ${warning}`);
  }

  return {
    name: preset.name,
    behavior: preset.behavior,
    graph: preset.graph,
    plugins: createBehaviorPlugins(behaviorPlugins),
    behaviorPlugins,
    behaviorPfScript: preset.behaviorPfScript,
    extensions: preset.extensions,
    warnings,
  };
}
