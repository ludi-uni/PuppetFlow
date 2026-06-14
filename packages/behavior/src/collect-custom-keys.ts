import type { BehaviorBlock, BehaviorStatement } from "./ast.js";
import { parseAssignTarget } from "./motion-aliases.js";

function collectFromStatements(
  statements: BehaviorStatement[],
  keys: Set<string>,
): void {
  for (const statement of statements) {
    switch (statement.type) {
      case "Block":
        collectFromStatements(statement.statements, keys);
        break;
      case "If":
        collectFromStatements(statement.then, keys);
        if (statement.else) {
          collectFromStatements(statement.else, keys);
        }
        break;
      case "ExprAssign": {
        const target = parseAssignTarget(statement.target);
        if (typeof target !== "string") {
          keys.add(target.custom);
        }
        break;
      }
      case "Assign": {
        const target = parseAssignTarget(statement.key);
        if (typeof target !== "string") {
          keys.add(target.custom);
        }
        break;
      }
      default:
        break;
    }
  }
}

/** Collects `MotionState.custom` keys assigned in a behavior block. */
export function collectBehaviorCustomMotionKeys(block: BehaviorBlock): string[] {
  const keys = new Set<string>();
  collectFromStatements(block.statements, keys);
  return [...keys].sort();
}
