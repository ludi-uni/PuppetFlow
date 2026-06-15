import type { BehaviorBlock } from "@puppetflow/behavior";
import {
  compilePfScript,
  compileToBehaviorJson,
  parsePfScript,
  PfScriptParseError,
  SPEC_SAMPLE_PFSCRIPT,
} from "@puppetflow/pfscript-core";
import type { PfScriptStatement } from "@puppetflow/pfscript-core";

export interface PfScriptCompileResult {
  behavior: BehaviorBlock;
  behaviorJson: string;
}

export interface PfScriptCompileFailure {
  message: string;
  line?: number;
  column?: number;
}

export function extractBehaviorPfScript(presetJson: string): string {
  const parsed = JSON.parse(presetJson) as { behaviorPfScript?: unknown };
  return typeof parsed.behaviorPfScript === "string" ? parsed.behaviorPfScript : "";
}

export function mergePfScriptIntoPreset(
  presetJson: string,
  behaviorPfScript: string,
  behavior: BehaviorBlock,
): string {
  const parsed = JSON.parse(presetJson) as Record<string, unknown>;
  parsed.behaviorPfScript = behaviorPfScript;
  parsed.behavior = behavior;
  return JSON.stringify(parsed, null, 2);
}

export function compilePfScriptSource(source: string): PfScriptCompileResult {
  const behavior = compilePfScript(source);
  return {
    behavior,
    behaviorJson: compileToBehaviorJson(source),
  };
}

export function tryCompilePfScriptSource(
  source: string,
): PfScriptCompileResult | PfScriptCompileFailure {
  try {
    return compilePfScriptSource(source);
  } catch (error) {
    if (error instanceof PfScriptParseError) {
      return {
        message: error.message.replace(/\s*\(\d+:\d+\)$/, ""),
        line: error.line,
        column: error.column,
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return { message };
  }
}
function collectPfScriptCallIds(statements: PfScriptStatement[], ids: string[]): void {
  for (const statement of statements) {
    if (statement.type === "CallStmt") {
      ids.push(statement.callee);
      continue;
    }

    if (statement.type === "If") {
      collectPfScriptCallIds(statement.then, ids);
      for (const clause of statement.elseif) {
        collectPfScriptCallIds(clause.body, ids);
      }
      if (statement.else) {
        collectPfScriptCallIds(statement.else, ids);
      }
    }
  }
}

export function parseMotionPackIdsFromPfScript(source: string): string[] {
  const trimmed = source.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const program = parsePfScript(trimmed);
    const ids: string[] = [];
    collectPfScriptCallIds(program.body, ids);
    return [...new Set(ids.filter((id) => id.length > 0))];
  } catch {
    return [];
  }
}

export function findPfScriptExtensionPackDuplicates(
  presetJson: string,
  pfScriptSource: string,
): string[] {
  const pfscriptPackIds = parseMotionPackIdsFromPfScript(pfScriptSource);
  if (pfscriptPackIds.length === 0) {
    return [];
  }

  let extensionPackIds: string[] = [];
  try {
    const parsed = JSON.parse(presetJson) as {
      extensions?: { packs?: Array<{ id?: string }> };
    };
    extensionPackIds = (parsed.extensions?.packs ?? [])
      .map((pack) => pack.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }

  const extensionSet = new Set(extensionPackIds);
  return [...new Set(pfscriptPackIds.filter((id) => extensionSet.has(id)))];
}

export function formatPfScriptDuplicateWarning(ids: string[]): string | null {
  if (ids.length === 0) {
    return null;
  }
  return `PFScript の Pack 呼び出しと extensions.packs が重複: ${ids.join(", ")}`;
}

export { SPEC_SAMPLE_PFSCRIPT };
