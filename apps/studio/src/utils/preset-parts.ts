import { mergeExtensionsPart } from "./extension-config.js";

export interface PresetPartOverrides {
  behaviorPluginsJson?: string;
  behaviorJson?: string;
  graphJson?: string;
  extensionsJson?: string;
}

/** Merges split editor state into one preset JSON string (order: plugins → extensions → graph → behavior). */
export function assemblePresetFromParts(
  presetJson: string,
  parts: PresetPartOverrides,
): string {
  let json = presetJson;

  if (parts.behaviorPluginsJson !== undefined) {
    json = mergeBehaviorPluginsPart(json, parts.behaviorPluginsJson);
  }
  if (parts.extensionsJson !== undefined) {
    json = mergeExtensionsPart(json, parts.extensionsJson);
  }
  if (parts.graphJson !== undefined) {
    json = mergeGraphPart(json, parts.graphJson);
  }
  if (parts.behaviorJson !== undefined) {
    json = mergeBehaviorPart(json, parts.behaviorJson);
  }

  return json;
}

export function extractBehaviorJson(presetJson: string): string {
  const parsed = JSON.parse(presetJson) as { behavior?: unknown };
  return JSON.stringify(parsed.behavior ?? { type: "Block", statements: [] }, null, 2);
}

export function extractGraphJson(presetJson: string): string {
  const parsed = JSON.parse(presetJson) as { graph?: unknown };
  return JSON.stringify(parsed.graph ?? { nodes: [], edges: [] }, null, 2);
}

export function extractBehaviorPluginsJson(presetJson: string): string {
  const parsed = JSON.parse(presetJson) as { behaviorPlugins?: unknown };
  return JSON.stringify(parsed.behaviorPlugins ?? [], null, 2);
}

export function mergeBehaviorPart(presetJson: string, behaviorJson: string): string {
  const parsed = JSON.parse(presetJson) as Record<string, unknown>;
  parsed.behavior = JSON.parse(behaviorJson);
  return JSON.stringify(parsed, null, 2);
}

export function mergeGraphPart(presetJson: string, graphJson: string): string {
  const parsed = JSON.parse(presetJson) as Record<string, unknown>;
  parsed.graph = JSON.parse(graphJson);
  return JSON.stringify(parsed, null, 2);
}

export function mergeBehaviorPluginsPart(
  presetJson: string,
  behaviorPluginsJson: string,
): string {
  const parsed = JSON.parse(presetJson) as Record<string, unknown>;
  parsed.behaviorPlugins = JSON.parse(behaviorPluginsJson);
  return JSON.stringify(parsed, null, 2);
}
