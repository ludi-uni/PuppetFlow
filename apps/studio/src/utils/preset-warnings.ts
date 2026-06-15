import type { BehaviorBlock } from "@puppetflow/behavior";
import type { MotionGraphDocument } from "@puppetflow/motion-graph";
import {
  detectPresetMotionOverlaps,
  loadPreset,
  type PresetOverlapWarning,
} from "@puppetflow/preset";

export function parseGraphJson(graphJson: string): MotionGraphDocument {
  try {
    const parsed = JSON.parse(graphJson) as Partial<MotionGraphDocument>;
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
    };
  } catch {
    return { nodes: [], edges: [] };
  }
}

export function parseBehaviorPluginsJson(
  behaviorPluginsJson: string,
): Array<{ id: string; config?: Record<string, unknown> }> {
  try {
    const parsed = JSON.parse(behaviorPluginsJson) as Array<{
      id?: string;
      config?: unknown;
    }>;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((entry): entry is { id: string; config?: Record<string, unknown> } => {
        return typeof entry.id === "string" && entry.id.length > 0;
      })
      .map((entry) => ({
        id: entry.id,
        config:
          typeof entry.config === "object" && entry.config !== null
            ? (entry.config as Record<string, unknown>)
            : undefined,
      }));
  } catch {
    return [];
  }
}

export function detectPresetStageOverlaps(input: {
  behavior: BehaviorBlock;
  graphJson: string;
  behaviorPluginsJson: string;
}): PresetOverlapWarning[] {
  return detectPresetMotionOverlaps({
    behavior: input.behavior,
    graph: parseGraphJson(input.graphJson),
    behaviorPlugins: parseBehaviorPluginsJson(input.behaviorPluginsJson),
  });
}

function formatOverlapSource(source: string): string {
  if (source.startsWith("plugin:")) {
    return `${source.slice("plugin:".length)} プラグイン`;
  }
  if (source === "graph") {
    return "Graph";
  }
  if (source === "behavior") {
    return "PFScript / behavior";
  }
  return source;
}

export function formatOverlapWarning(overlap: PresetOverlapWarning): string {
  const sources = overlap.sources.map(formatOverlapSource).join(" と ");
  return `Motion キー「${overlap.motionKey}」が ${sources} の両方で出力されています`;
}

export function formatOverlapWarnings(overlaps: PresetOverlapWarning[]): string | null {
  if (overlaps.length === 0) {
    return null;
  }
  return overlaps.map(formatOverlapWarning).join("。");
}

export function collectLoadPresetWarnings(json: string): string[] {
  try {
    return loadPreset(json).warnings;
  } catch {
    return [];
  }
}

export function formatLoadOverlapWarnings(warnings: string[]): string | null {
  const overlaps = warnings.filter((warning) =>
    warning.includes("produced by multiple stages"),
  );
  if (overlaps.length === 0) {
    return null;
  }

  return overlaps
    .map((warning) => {
      const match = warning.match(
        /motion key "([^"]+)" is produced by multiple stages: (.+)/,
      );
      if (!match) {
        return warning;
      }
      const [, motionKey, sources] = match;
      const labels = sources.split(", ").map(formatOverlapSource);
      return `Motion キー「${motionKey}」が ${labels.join(" と ")} で重複しています`;
    })
    .join("。");
}
