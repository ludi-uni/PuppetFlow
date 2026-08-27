import type { BehaviorBlock } from "@puppetflow/behavior";
import { parsePfScript } from "./parser.js";
import { lowerPfScriptToBehavior } from "./lower.js";
import { assertNoLetDeclarations } from "./validation.js";

export function compilePfScript(source: string): BehaviorBlock {
  const program = parsePfScript(source);
  assertNoLetDeclarations(program.body);
  return lowerPfScriptToBehavior(program);
}

export function compileToBehaviorJson(source: string, pretty = true): string {
  const behavior = compilePfScript(source);
  return JSON.stringify(behavior, null, pretty ? 2 : undefined);
}
