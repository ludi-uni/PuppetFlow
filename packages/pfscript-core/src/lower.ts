import type {
  BehaviorBlock,
  BehaviorCondition,
  BehaviorExprAssign,
  BehaviorIf,
  BehaviorMotionPack,
  BehaviorStatement,
  CompareCondition,
  CompareOp,
  StringCompareCondition,
} from "@puppetflow/behavior";
import { formatAssignTarget } from "@puppetflow/behavior";
import type { BehaviorExpression, BehaviorNamedArgExpr } from "@puppetflow/behavior";
import type {
  PfScriptBinary,
  PfScriptBinaryOp,
  PfScriptCallStmt,
  PfScriptExpression,
  PfScriptIf,
  PfScriptNamedArg,
  PfScriptProgram,
  PfScriptStatement,
} from "./ast.js";

const COMPARE_OPS = new Set<PfScriptBinaryOp>([">", ">=", "<", "<=", "==", "!="]);

export function lowerPfScriptToBehavior(program: PfScriptProgram): BehaviorBlock {
  return {
    type: "Block",
    statements: lowerStatements(program.body),
  };
}

function lowerStatements(statements: PfScriptStatement[]): BehaviorStatement[] {
  return statements.flatMap((statement) => {
    const lowered = lowerStatement(statement);
    return lowered ? [lowered] : [];
  });
}

function lowerStatement(statement: PfScriptStatement): BehaviorStatement | undefined {
  switch (statement.type) {
    case "Assign":
      return lowerAssign(statement.target, statement.value);
    case "If":
      return lowerIf(statement);
    case "CallStmt":
      return lowerCallStmt(statement);
    default:
      return undefined;
  }
}

function lowerAssign(target: string, value: PfScriptExpression): BehaviorExprAssign {
  return {
    type: "ExprAssign",
    target: formatAssignTarget(target),
    value: lowerExpression(value),
  };
}

function lowerIf(statement: PfScriptIf): BehaviorIf {
  let elseBranch: BehaviorStatement[] | undefined = statement.else
    ? lowerStatements(statement.else)
    : undefined;

  for (let index = statement.elseif.length - 1; index >= 0; index -= 1) {
    const clause = statement.elseif[index];
    if (!clause) {
      continue;
    }
    elseBranch = [
      {
        type: "If",
        condition: lowerCondition(clause.condition),
        then: lowerStatements(clause.body),
        else: elseBranch,
      },
    ];
  }

  return {
    type: "If",
    condition: lowerCondition(statement.condition),
    then: lowerStatements(statement.then),
    else: elseBranch,
  };
}

function lowerCallStmt(statement: PfScriptCallStmt): BehaviorMotionPack {
  const config = lowerCallConfig(statement.args);
  return {
    type: "MotionPack",
    packId: statement.callee,
    config: Object.keys(config).length > 0 ? config : undefined,
  };
}

function lowerCallConfig(args: PfScriptNamedArg[]): Record<string, number> {
  const config: Record<string, number> = {};
  for (const arg of args) {
    if (!arg.name) {
      continue;
    }
    if (arg.value.type === "Number") {
      config[arg.name] = arg.value.value;
    }
  }
  return config;
}

function lowerCondition(expression: PfScriptExpression): BehaviorCondition {
  if (expression.type === "Binary") {
    if (expression.op === "and") {
      return {
        type: "And",
        conditions: [lowerCondition(expression.left), lowerCondition(expression.right)],
      };
    }
    if (expression.op === "or") {
      return {
        type: "Or",
        conditions: [lowerCondition(expression.left), lowerCondition(expression.right)],
      };
    }
    if (COMPARE_OPS.has(expression.op)) {
      return lowerCompareCondition(expression);
    }
  }

  if (expression.type === "Unary" && expression.op === "not") {
    return {
      type: "Not",
      condition: lowerCondition(expression.argument),
    };
  }

  throw new Error(`unsupported PFScript condition expression: ${expression.type}`);
}

function lowerCompareCondition(expression: PfScriptBinary): BehaviorCondition {
  const stringCompare = tryLowerStringCompare(expression);
  if (stringCompare) {
    return stringCompare;
  }

  const numericCompare = tryLowerNumericCompare(expression);
  if (numericCompare) {
    return numericCompare;
  }

  throw new Error("compare conditions require identifier and literal operands");
}

function tryLowerStringCompare(expression: PfScriptBinary): StringCompareCondition | undefined {
  if (expression.op !== "==" && expression.op !== "!=") {
    return undefined;
  }

  const identifier = readIdentifier(expression.left);
  const stringLiteral = readStringLiteral(expression.right);
  if (identifier && stringLiteral !== undefined) {
    return {
      kind: "StringCompare",
      left: identifier,
      op: expression.op,
      right: stringLiteral,
    };
  }

  const reverseIdentifier = readIdentifier(expression.right);
  const reverseString = readStringLiteral(expression.left);
  if (reverseIdentifier && reverseString !== undefined) {
    return {
      kind: "StringCompare",
      left: reverseIdentifier,
      op: expression.op,
      right: reverseString,
    };
  }

  return undefined;
}

function tryLowerNumericCompare(expression: PfScriptBinary): CompareCondition | undefined {
  const left = readIdentifier(expression.left);
  const right = readNumberLiteral(expression.right);
  if (left && right !== undefined && isCompareOp(expression.op)) {
    return { left, op: expression.op, right };
  }

  return undefined;
}

function lowerExpression(expression: PfScriptExpression): BehaviorExpression {
  switch (expression.type) {
    case "Number":
      return { type: "Number", value: expression.value };
    case "String":
      return { type: "String", value: expression.value };
    case "Boolean":
      return { type: "Boolean", value: expression.value };
    case "Identifier":
      return { type: "Identifier", name: expression.name };
    case "Unary":
      return {
        type: "Unary",
        op: expression.op,
        argument: lowerExpression(expression.argument),
      };
    case "Binary":
      return {
        type: "Binary",
        op: expression.op,
        left: lowerExpression(expression.left),
        right: lowerExpression(expression.right),
      };
    case "Call":
      return {
        type: "Call",
        callee: expression.callee,
        args: lowerNamedArgs(expression.args),
      };
    default:
      throw new Error(`unsupported PFScript expression: ${(expression as { type?: string }).type}`);
  }
}

function lowerNamedArgs(args: PfScriptNamedArg[]): BehaviorNamedArgExpr[] {
  return args.map((arg) => ({
    name: arg.name,
    value: lowerExpression(arg.value),
  }));
}

function readIdentifier(expression: PfScriptExpression): string | undefined {
  return expression.type === "Identifier" ? expression.name : undefined;
}

function readStringLiteral(expression: PfScriptExpression): string | undefined {
  return expression.type === "String" ? expression.value : undefined;
}

function readNumberLiteral(expression: PfScriptExpression): number | undefined {
  return expression.type === "Number" ? expression.value : undefined;
}

function isCompareOp(op: PfScriptBinaryOp): op is CompareOp {
  return COMPARE_OPS.has(op);
}
