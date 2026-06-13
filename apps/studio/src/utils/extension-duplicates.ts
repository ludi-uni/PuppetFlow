import type { Node } from "@xyflow/react";

export interface DuplicatePackReport {
  /** Pack IDs enabled in extensions.packs that also appear as motionPack graph nodes */
  presetAndGraph: string[];
  /** Pack IDs duplicated within graph motionPack nodes */
  graphOnly: string[];
}

function collectBehaviorPackIds(behavior: unknown, ids: string[]): void {
  if (typeof behavior !== "object" || behavior === null) {
    return;
  }

  const block = behavior as {
    type?: string;
    packId?: string;
    statements?: unknown[];
    then?: unknown[];
    else?: unknown[];
  };

  if (block.type === "MotionPack" && typeof block.packId === "string") {
    ids.push(block.packId);
  }

  if (Array.isArray(block.statements)) {
    for (const statement of block.statements) {
      collectBehaviorPackIds(statement, ids);
    }
  }

  if (Array.isArray(block.then)) {
    for (const statement of block.then) {
      collectBehaviorPackIds(statement, ids);
    }
  }

  if (Array.isArray(block.else)) {
    for (const statement of block.else) {
      collectBehaviorPackIds(statement, ids);
    }
  }
}

export function parseMotionPackIdsFromGraphJson(graphJson: string): string[] {
  try {
    const parsed = JSON.parse(graphJson) as {
      nodes?: Array<{ type?: string; data?: { packId?: unknown } }>;
    };
    return (parsed.nodes ?? [])
      .filter((node) => node.type === "motionPack")
      .map((node) => String(node.data?.packId ?? ""))
      .filter((id) => id.length > 0);
  } catch {
    return [];
  }
}

function buildDuplicateReport(
  presetJson: string,
  graphPackIds: string[],
): DuplicatePackReport {
  let presetPackIds: string[] = [];
  const behaviorPackIds: string[] = [];

  try {
    const parsed = JSON.parse(presetJson) as {
      extensions?: { packs?: Array<{ id?: string }> };
      behavior?: unknown;
    };
    presetPackIds = (parsed.extensions?.packs ?? [])
      .map((pack) => pack.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    collectBehaviorPackIds(parsed.behavior, behaviorPackIds);
  } catch {
    return { presetAndGraph: [], graphOnly: [] };
  }

  const presetSources = new Set([...presetPackIds, ...behaviorPackIds]);
  const presetAndGraph = [
    ...new Set(graphPackIds.filter((id) => presetSources.has(id))),
  ];

  const graphCounts = new Map<string, number>();
  for (const id of graphPackIds) {
    graphCounts.set(id, (graphCounts.get(id) ?? 0) + 1);
  }
  const graphOnly = [...graphCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  return { presetAndGraph, graphOnly };
}

export function findDuplicateExtensionPackIds(
  presetJson: string,
  graphNodes: Node[],
): DuplicatePackReport {
  const graphPackIds = graphNodes
    .filter((node) => node.type === "motionPack")
    .map((node) => String(node.data.packId ?? ""))
    .filter((id) => id.length > 0);

  return buildDuplicateReport(presetJson, graphPackIds);
}

export function findDuplicateExtensionPackIdsFromGraphJson(
  presetJson: string,
  graphJson: string,
): DuplicatePackReport {
  return buildDuplicateReport(presetJson, parseMotionPackIdsFromGraphJson(graphJson));
}

export function formatDuplicatePackWarning(report: DuplicatePackReport): string | null {
  const parts: string[] = [];

  if (report.presetAndGraph.length > 0) {
    parts.push(
      `オプション動き / Behavior と Graph で重複: ${report.presetAndGraph.join(", ")}`,
    );
  }

  if (report.graphOnly.length > 0) {
    parts.push(`Graph 内で Motion Pack が重複: ${report.graphOnly.join(", ")}`);
  }

  return parts.length > 0 ? parts.join("。") : null;
}
