import type { BehaviorBlock } from "@puppetflow/behavior";
import type { PfScriptStatement } from "./ast.js";
import { parsePfScript } from "./parser.js";
import { lowerPfScriptToBehavior } from "./lower.js";

export function compilePfScript(source: string): BehaviorBlock {
  const program = parsePfScript(source);
  assertNoLetDeclarations(program.body);
  return lowerPfScriptToBehavior(program);
}

export function compileToBehaviorJson(source: string, pretty = true): string {
  const behavior = compilePfScript(source);
  return JSON.stringify(behavior, null, pretty ? 2 : undefined);
}

function assertNoLetDeclarations(statements: PfScriptStatement[]): void {
  for (const statement of statements) {
    if (statement.type === "Let") {
      throw new Error("PFScript let declarations are not supported by compilation");
    }

    if (statement.type === "If") {
      assertNoLetDeclarations(statement.then);
      for (const clause of statement.elseif) {
        assertNoLetDeclarations(clause.body);
      }
      if (statement.else) {
        assertNoLetDeclarations(statement.else);
      }
    }
  }
}
