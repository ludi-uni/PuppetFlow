export function extractBehaviorJson(presetJson: string): string {
  const parsed = JSON.parse(presetJson) as { behavior?: unknown };
  return JSON.stringify(parsed.behavior ?? { type: "Block", statements: [] }, null, 2);
}

export function extractGraphJson(presetJson: string): string {
  const parsed = JSON.parse(presetJson) as { graph?: unknown };
  return JSON.stringify(parsed.graph ?? { nodes: [], edges: [] }, null, 2);
}

export function extractRulesJson(presetJson: string): string {
  const parsed = JSON.parse(presetJson) as { rules?: unknown };
  return JSON.stringify(parsed.rules ?? [], null, 2);
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

export function mergeRulesPart(presetJson: string, rulesJson: string): string {
  const parsed = JSON.parse(presetJson) as Record<string, unknown>;
  parsed.rules = JSON.parse(rulesJson);
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
