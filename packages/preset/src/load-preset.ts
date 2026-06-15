import type { BehaviorBlock } from "@puppetflow/behavior";
import type { BehaviorPlugin } from "@puppetflow/core";
import { migrateLegacyMotionKey } from "@puppetflow/core";
import type { PresetExtensions } from "@puppetflow/extension-core";
import { parseMotionGraph, type MotionGraphDocument } from "@puppetflow/motion-graph";
import type { PuppetFlowPreset } from "./types.js";
import { compilePresetBehavior } from "./compile-behavior.js";
import { detectPresetMotionOverlaps } from "./collect-preset-motion-keys.js";
import { createBehaviorPlugins, type BehaviorPluginConfig } from "./plugin-factory.js";

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

// --- Legacy motion key migration (raw preset JSON) ---

function migrateBehaviorJson(value: unknown, warnings: string[], path: string): void {
  if (typeof value !== "object" || value === null) {
    return;
  }

  const obj = value as Record<string, unknown>;

  if (obj.type === "Assign" && typeof obj.key === "string") {
    const { key, migrated } = migrateLegacyMotionKey(obj.key);
    if (migrated) {
      warnings.push(`${path}: migrated motion key "${obj.key}" → "${key}"`);
      obj.key = key;
    }
  }

  for (const field of ["statements", "then", "else"] as const) {
    const branch = obj[field];
    if (!Array.isArray(branch)) {
      continue;
    }
    branch.forEach((item, index) =>
      migrateBehaviorJson(item, warnings, `${path}.${field}[${index}]`),
    );
  }
}

function migrateGraphJson(graph: Record<string, unknown>, warnings: string[]): void {
  const nodes = graph.nodes;
  if (!Array.isArray(nodes)) {
    return;
  }

  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if (typeof node !== "object" || node === null) {
      continue;
    }

    const parsed = node as Record<string, unknown>;
    if (parsed.type !== "output") {
      continue;
    }

    const data = parsed.data;
    if (typeof data !== "object" || data === null) {
      continue;
    }

    const output = data as Record<string, unknown>;
    if (typeof output.key !== "string") {
      continue;
    }

    const { key, migrated } = migrateLegacyMotionKey(output.key);
    if (migrated) {
      warnings.push(
        `graph.nodes[${index}]: migrated motion key "${output.key}" → "${key}"`,
      );
      output.key = key;
    }
  }
}

function migratePresetMotionKeys(preset: Record<string, unknown>): string[] {
  const warnings: string[] = [];

  if (preset.behavior !== undefined) {
    migrateBehaviorJson(preset.behavior, warnings, "behavior");
  }

  if (typeof preset.graph === "object" && preset.graph !== null) {
    migrateGraphJson(preset.graph as Record<string, unknown>, warnings);
  }

  return warnings;
}

// --- Preset parse / load ---

function parsePresetJsonObject(
  json: string,
): Partial<PuppetFlowPreset> & Record<string, unknown> {
  const byteLength = new TextEncoder().encode(json).length;
  if (byteLength > MAX_PRESET_JSON_BYTES) {
    throw new Error(`Preset JSON exceeds max size (${MAX_PRESET_JSON_BYTES} bytes)`);
  }

  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Preset must be a JSON object");
  }

  return parsed as Partial<PuppetFlowPreset> & Record<string, unknown>;
}

function collectPresetWarnings(
  behavior: BehaviorBlock,
  graph: MotionGraphDocument,
  behaviorPlugins: BehaviorPluginConfig[],
  migrationWarnings: string[],
): string[] {
  const warnings = [...migrationWarnings];

  for (const overlap of detectPresetMotionOverlaps({
    behavior,
    graph,
    behaviorPlugins,
  })) {
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
  return parsePresetRecord(parsePresetJsonObject(json)).preset;
}

export function loadPreset(json: string): LoadedPreset {
  const { preset, migrationWarnings } = parsePresetRecord(parsePresetJsonObject(json));
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
