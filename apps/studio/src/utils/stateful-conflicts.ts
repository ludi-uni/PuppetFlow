import type { BehaviorBlock, BehaviorStatement } from "@puppetflow/behavior";

const GAZE_KEYS = new Set(["lookX", "lookY"]);
const BLINK_KEYS = new Set(["eyeYaw"]);

function collectExprAssignTargets(statements: BehaviorStatement[], targets: Set<string>): void {
  for (const statement of statements) {
    switch (statement.type) {
      case "Block":
        collectExprAssignTargets(statement.statements, targets);
        break;
      case "If":
        collectExprAssignTargets(statement.then, targets);
        if (statement.else) {
          collectExprAssignTargets(statement.else, targets);
        }
        break;
      case "ExprAssign":
        targets.add(statement.target);
        break;
      default:
        break;
    }
  }
}

function parseBehaviorPluginIds(behaviorPluginsJson: string): string[] {
  try {
    const parsed = JSON.parse(behaviorPluginsJson) as Array<{ id?: string }>;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => entry.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export function findStatefulPluginConflicts(
  behaviorPluginsJson: string,
  behavior: BehaviorBlock,
): string[] {
  const pluginIds = new Set(parseBehaviorPluginIds(behaviorPluginsJson));
  const assignedTargets = new Set<string>();
  collectExprAssignTargets(behavior.statements, assignedTargets);

  const warnings: string[] = [];

  if (pluginIds.has("gaze") && [...assignedTargets].some((key) => GAZE_KEYS.has(key))) {
    warnings.push(
      "gaze プラグインと behavior の lookX / lookY 代入が重複しています（どちらか一方を推奨）",
    );
  }

  if (pluginIds.has("blink") && [...assignedTargets].some((key) => BLINK_KEYS.has(key))) {
    warnings.push(
      "blink プラグインと behavior の eyeYaw 代入が重複しています（どちらか一方を推奨）",
    );
  }

  return warnings;
}

export function formatStatefulPluginConflictWarning(warnings: string[]): string | null {
  return warnings.length > 0 ? warnings.join("。") : null;
}
