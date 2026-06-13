import type { BehaviorBlock } from "@puppetflow/behavior";
import { parseBehaviorRoot } from "@puppetflow/behavior";
import { compilePfScript } from "@puppetflow/pfscript-core";
import { PfScriptParseError } from "@puppetflow/pfscript-core";

export class PresetPfScriptError extends Error {
  readonly line?: number;
  readonly column?: number;

  constructor(message: string, options?: { line?: number; column?: number; cause?: unknown }) {
    const location =
      options?.line !== undefined && options.column !== undefined
        ? ` (${options.line}:${options.column})`
        : "";
    super(`${message}${location}`);
    this.name = "PresetPfScriptError";
    this.line = options?.line;
    this.column = options?.column;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export interface PresetBehaviorSource {
  behavior?: unknown;
  behaviorPfScript?: unknown;
}

export interface CompiledPresetBehavior {
  behavior: BehaviorBlock;
  behaviorPfScript?: string;
}

function compilePfScriptSource(source: string): BehaviorBlock {
  try {
    return compilePfScript(source);
  } catch (error) {
    if (error instanceof PfScriptParseError) {
      throw new PresetPfScriptError(error.message.replace(/\s*\(\d+:\d+\)$/, ""), {
        line: error.line,
        column: error.column,
        cause: error,
      });
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new PresetPfScriptError(`PFScript compile failed: ${message}`, { cause: error });
  }
}

export function compilePresetBehavior(source: PresetBehaviorSource): CompiledPresetBehavior {
  const pfScript =
    typeof source.behaviorPfScript === "string" && source.behaviorPfScript.trim().length > 0
      ? source.behaviorPfScript
      : undefined;

  if (pfScript) {
    return {
      behavior: compilePfScriptSource(pfScript),
      behaviorPfScript: pfScript,
    };
  }

  if (source.behavior !== undefined) {
    return {
      behavior: parseBehaviorRoot(source.behavior),
    };
  }

  throw new Error("Preset requires behavior or behaviorPfScript");
}
