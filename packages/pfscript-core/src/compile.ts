import type { BehaviorBlock } from "@puppetflow/behavior";
import { parsePfScript } from "./parser.js";
import { lowerPfScriptToBehavior } from "./lower.js";

export function compilePfScript(source: string): BehaviorBlock {
  return lowerPfScriptToBehavior(parsePfScript(source));
}

export function compileToBehaviorJson(source: string, pretty = true): string {
  const behavior = compilePfScript(source);
  return JSON.stringify(behavior, null, pretty ? 2 : undefined);
}
