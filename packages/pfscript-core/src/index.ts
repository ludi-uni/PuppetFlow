import type { ExtensionContext } from "@puppetflow/extension-core";
import {
  executePfScriptFunction,
  type MotionRegistryImpl,
} from "@puppetflow/extension-core";

export interface PfScriptCall {
  name: string;
  args: Record<string, number>;
}

const CALL_PATTERN = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/;

function parseArgs(raw: string): Record<string, number> {
  const args: Record<string, number> = {};
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const [key, value] = trimmed.split("=").map((token) => token.trim());
    if (key && value !== undefined) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        args[key] = numeric;
      }
    }
  }
  return args;
}

export function parsePfScriptCall(source: string): PfScriptCall | null {
  const match = source.trim().match(CALL_PATTERN);
  if (!match) {
    return null;
  }
  return {
    name: match[1] ?? "",
    args: parseArgs(match[2] ?? ""),
  };
}

export function evaluatePfScriptExpression(
  registry: MotionRegistryImpl,
  ctx: ExtensionContext,
  expression: string,
): number {
  const call = parsePfScriptCall(expression);
  if (!call) {
    return 0;
  }
  return executePfScriptFunction(registry, ctx, call.name, call.args);
}
