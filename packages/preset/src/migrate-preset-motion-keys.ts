import { migrateLegacyMotionKey } from "@puppetflow/core";

function migrateBehaviorJson(
  value: unknown,
  warnings: string[],
  path: string,
): void {
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

/** Rewrites legacy motion keys in raw preset JSON before parsing behavior/graph. */
export function migratePresetMotionKeys(preset: Record<string, unknown>): string[] {
  const warnings: string[] = [];

  if (preset.behavior !== undefined) {
    migrateBehaviorJson(preset.behavior, warnings, "behavior");
  }

  if (typeof preset.graph === "object" && preset.graph !== null) {
    migrateGraphJson(preset.graph as Record<string, unknown>, warnings);
  }

  return warnings;
}
