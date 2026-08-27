import type { PfScriptStatement } from "./ast.js";

export function assertNoLetDeclarations(statements: PfScriptStatement[]): void {
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
