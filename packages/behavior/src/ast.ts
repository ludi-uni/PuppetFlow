import { MOTION_STATE_KEYS, type MotionStateKey } from "@puppetflow/core";
import type { BehaviorExpression, BehaviorNamedArgExpr } from "./expr.js";

const COMPARE_OPS = new Set<CompareOp>([">", ">=", "<", "<=", "==", "!="]);
const BINARY_OPERATORS = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "==",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "and",
  "or",
]);
const ASSIGN_OPS = new Set<AssignOp>(["set", "add"]);
const MAX_BEHAVIOR_DEPTH = 32;
const MAX_STATEMENTS_PER_BLOCK = 500;

export type CompareOp = ">" | ">=" | "<" | "<=" | "==" | "!=";

export interface CompareCondition {
  left: string;
  op: CompareOp;
  right: number;
}

export interface LogicAnd {
  type: "And";
  conditions: BehaviorCondition[];
}

export interface LogicOr {
  type: "Or";
  conditions: BehaviorCondition[];
}

export interface LogicNot {
  type: "Not";
  condition: BehaviorCondition;
}

export interface StringCompareCondition {
  kind: "StringCompare";
  left: string;
  op: "==" | "!=";
  right: string;
}

export interface BehaviorExprCondition {
  kind: "Expr";
  expression: BehaviorExpression;
}

export type BehaviorCondition =
  | CompareCondition
  | StringCompareCondition
  | BehaviorExprCondition
  | LogicAnd
  | LogicOr
  | LogicNot;

export interface BehaviorBlock {
  type: "Block";
  statements: BehaviorStatement[];
}

export interface BehaviorIf {
  type: "If";
  condition: BehaviorCondition;
  then: BehaviorStatement[];
  else?: BehaviorStatement[];
}

export type AssignOp = "set" | "add";

export interface BehaviorAssign {
  type: "Assign";
  key: MotionStateKey;
  op: AssignOp;
  value: number;
}

export interface BehaviorMotionPack {
  type: "MotionPack";
  packId: string;
  config?: Record<string, number>;
  configExpressions?: Record<string, BehaviorExpression>;
}

export interface BehaviorExprAssign {
  type: "ExprAssign";
  target: string;
  value: BehaviorExpression;
}

export interface BehaviorLocalLet {
  type: "LocalLet";
  name: string;
  value: BehaviorExpression;
}

export interface BehaviorLocalAssign {
  type: "LocalAssign";
  name: string;
  value: BehaviorExpression;
}

export type BehaviorStatement =
  | BehaviorBlock
  | BehaviorIf
  | BehaviorAssign
  | BehaviorExprAssign
  | BehaviorLocalLet
  | BehaviorLocalAssign
  | BehaviorMotionPack;

export function isBehaviorCondition(value: unknown): value is BehaviorCondition {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if ("left" in value && "op" in value && "right" in value) {
    return true;
  }

  if ("kind" in value && (value as { kind?: string }).kind === "Expr") {
    return true;
  }

  return (
    "type" in value &&
    ["And", "Or", "Not"].includes(String((value as { type?: string }).type))
  );
}

function isMotionStateKey(value: string): value is MotionStateKey {
  return (MOTION_STATE_KEYS as readonly string[]).includes(value);
}

function parseBehaviorCondition(value: unknown, path: string): BehaviorCondition {
  if (typeof value !== "object" || value === null) {
    throw new Error(`behavior condition must be an object at ${path}`);
  }

  if ("left" in value && "op" in value && "right" in value) {
    const condition = value as Partial<CompareCondition & StringCompareCondition>;
    if (condition.kind === "StringCompare" || typeof condition.right === "string") {
      if (typeof condition.left !== "string" || condition.left.length === 0) {
        throw new Error(`string compare requires a non-empty left key at ${path}`);
      }
      if (condition.op !== "==" && condition.op !== "!=") {
        throw new Error(`unsupported string compare operator at ${path}`);
      }
      if (typeof condition.right !== "string") {
        throw new Error(`string compare requires a string right value at ${path}`);
      }
      return {
        kind: "StringCompare",
        left: condition.left,
        op: condition.op,
        right: condition.right,
      };
    }

    if (typeof condition.left !== "string" || condition.left.length === 0) {
      throw new Error(`compare condition requires a non-empty left key at ${path}`);
    }
    if (!COMPARE_OPS.has(condition.op as CompareOp)) {
      throw new Error(`unsupported compare operator at ${path}`);
    }
    if (typeof condition.right !== "number") {
      throw new Error(`compare condition requires a numeric right value at ${path}`);
    }

    return {
      left: condition.left,
      op: condition.op as CompareOp,
      right: condition.right,
    };
  }

  if ("kind" in value && (value as { kind?: string }).kind === "Expr") {
    const exprCondition = value as Partial<BehaviorExprCondition>;
    if (!exprCondition.expression || typeof exprCondition.expression !== "object") {
      throw new Error(`Expr condition requires expression at ${path}`);
    }
    return {
      kind: "Expr",
      expression: parseBehaviorExpression(
        exprCondition.expression,
        `${path}.expression`,
      ),
    };
  }

  const logic = value as Partial<LogicAnd | LogicOr | LogicNot>;
  switch (logic.type) {
    case "And":
    case "Or": {
      if (!Array.isArray(logic.conditions)) {
        throw new Error(`${logic.type} condition requires conditions[] at ${path}`);
      }
      return {
        type: logic.type,
        conditions: logic.conditions.map((item, index) =>
          parseBehaviorCondition(item, `${path}.conditions[${index}]`),
        ),
      };
    }
    case "Not": {
      if (!("condition" in logic)) {
        throw new Error(`Not condition requires condition at ${path}`);
      }
      return {
        type: "Not",
        condition: parseBehaviorCondition(logic.condition, `${path}.condition`),
      };
    }
    default:
      throw new Error(`unsupported behavior condition at ${path}`);
  }
}

function parseBehaviorStatements(
  values: unknown[],
  depth: number,
  path: string,
): BehaviorStatement[] {
  if (values.length > MAX_STATEMENTS_PER_BLOCK) {
    throw new Error(
      `behavior statements exceed max count (${MAX_STATEMENTS_PER_BLOCK}) at ${path}`,
    );
  }

  return values.map((value, index) =>
    parseBehaviorStatement(value, depth, `${path}[${index}]`),
  );
}

function parseBehaviorStatement(
  value: unknown,
  depth: number,
  path: string,
): BehaviorStatement {
  if (depth > MAX_BEHAVIOR_DEPTH) {
    throw new Error(
      `behavior nesting exceeds max depth (${MAX_BEHAVIOR_DEPTH}) at ${path}`,
    );
  }

  if (typeof value !== "object" || value === null) {
    throw new Error(`behavior statement must be an object at ${path}`);
  }

  const rawType =
    typeof value === "object" && value !== null && "type" in value
      ? String((value as { type?: unknown }).type)
      : undefined;

  if (rawType === "Builtin") {
    throw new Error(
      `Builtin statements are no longer supported at ${path}. Use behaviorPlugins in the preset instead.`,
    );
  }

  const statement = value as Partial<BehaviorStatement>;
  switch (statement.type) {
    case "Block":
      if (!Array.isArray(statement.statements)) {
        throw new Error(`Block statement requires statements[] at ${path}`);
      }
      return {
        type: "Block",
        statements: parseBehaviorStatements(
          statement.statements,
          depth + 1,
          `${path}.statements`,
        ),
      };
    case "If": {
      if (!("condition" in statement) || !Array.isArray(statement.then)) {
        throw new Error(`If statement requires condition and then[] at ${path}`);
      }
      const elseBranch = statement.else;
      return {
        type: "If",
        condition: parseBehaviorCondition(statement.condition, `${path}.condition`),
        then: parseBehaviorStatements(statement.then, depth + 1, `${path}.then`),
        else:
          elseBranch === undefined
            ? undefined
            : parseBehaviorStatements(elseBranch, depth + 1, `${path}.else`),
      };
    }
    case "ExprAssign": {
      const exprAssign = statement as Partial<BehaviorExprAssign>;
      if (typeof exprAssign.target !== "string" || exprAssign.target.length === 0) {
        throw new Error(`ExprAssign requires a non-empty target at ${path}`);
      }
      if (typeof exprAssign.value !== "object" || exprAssign.value === null) {
        throw new Error(`ExprAssign requires a value expression at ${path}`);
      }
      return {
        type: "ExprAssign",
        target: exprAssign.target,
        value: parseBehaviorExpression(exprAssign.value, `${path}.value`),
      };
    }
    case "LocalLet":
    case "LocalAssign": {
      const local = statement as Partial<BehaviorLocalLet | BehaviorLocalAssign>;
      if (typeof local.name !== "string" || local.name.length === 0) {
        throw new Error(`${statement.type} requires a non-empty name at ${path}`);
      }
      if (typeof local.value !== "object" || local.value === null) {
        throw new Error(`${statement.type} requires a value expression at ${path}`);
      }
      return {
        type: statement.type,
        name: local.name,
        value: parseBehaviorExpression(local.value, `${path}.value`),
      };
    }
    case "Assign": {
      if (
        typeof statement.key !== "string" ||
        !isMotionStateKey(statement.key) ||
        typeof statement.op !== "string" ||
        !ASSIGN_OPS.has(statement.op as AssignOp) ||
        typeof statement.value !== "number"
      ) {
        throw new Error(`invalid Assign statement at ${path}`);
      }
      return {
        type: "Assign",
        key: statement.key,
        op: statement.op as AssignOp,
        value: statement.value,
      };
    }
    case "MotionPack": {
      const pack = statement as Partial<BehaviorMotionPack>;
      if (typeof pack.packId !== "string" || pack.packId.length === 0) {
        throw new Error(`MotionPack requires a non-empty packId at ${path}`);
      }
      const config = pack.config;
      const configExpressions = pack.configExpressions;
      if (config !== undefined && configExpressions !== undefined) {
        throw new Error(
          `MotionPack cannot contain both config and configExpressions at ${path}`,
        );
      }
      if (
        config !== undefined &&
        (typeof config !== "object" || config === null || Array.isArray(config))
      ) {
        throw new Error(`MotionPack config must be an object at ${path}`);
      }
      if (
        configExpressions !== undefined &&
        (typeof configExpressions !== "object" ||
          configExpressions === null ||
          Array.isArray(configExpressions))
      ) {
        throw new Error(`MotionPack configExpressions must be an object at ${path}`);
      }
      const normalized: Record<string, number> = {};
      if (config) {
        for (const [key, value] of Object.entries(config)) {
          if (typeof value === "number" && Number.isFinite(value)) {
            normalized[key] = value;
          }
        }
      }
      const normalizedExpressions: Record<string, BehaviorExpression> = {};
      if (configExpressions) {
        for (const [key, expression] of Object.entries(configExpressions)) {
          normalizedExpressions[key] = parseBehaviorExpression(
            expression,
            `${path}.configExpressions.${key}`,
          );
        }
      }
      return {
        type: "MotionPack",
        packId: pack.packId,
        ...(configExpressions === undefined
          ? { config: Object.keys(normalized).length > 0 ? normalized : undefined }
          : { configExpressions: normalizedExpressions }),
      };
    }
    default:
      throw new Error(`unsupported behavior statement at ${path}`);
  }
}

function parseBehaviorNamedArg(value: unknown, path: string): BehaviorNamedArgExpr {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`invalid call argument at ${path}`);
  }
  const arg = value as Record<string, unknown>;
  if (arg.name !== undefined && typeof arg.name !== "string") {
    throw new Error(`invalid call argument name at ${path}`);
  }
  return {
    ...(arg.name === undefined ? {} : { name: arg.name }),
    value: parseBehaviorExpression(arg.value, `${path}.value`),
  };
}

function parseBehaviorExpression(value: unknown, path: string): BehaviorExpression {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`invalid expression at ${path}`);
  }
  const expression = value as Record<string, unknown>;
  switch (expression.type) {
    case "Number":
      if (typeof expression.value !== "number" || !Number.isFinite(expression.value)) {
        throw new Error(`invalid Number expression at ${path}`);
      }
      return { type: "Number", value: expression.value };
    case "String":
      if (typeof expression.value !== "string") {
        throw new Error(`invalid String expression at ${path}`);
      }
      return { type: "String", value: expression.value };
    case "Boolean":
      if (typeof expression.value !== "boolean") {
        throw new Error(`invalid Boolean expression at ${path}`);
      }
      return { type: "Boolean", value: expression.value };
    case "Identifier":
      if (typeof expression.name !== "string" || expression.name.length === 0) {
        throw new Error(`invalid Identifier expression at ${path}`);
      }
      return { type: "Identifier", name: expression.name };
    case "Unary":
      if (expression.op !== "not" && expression.op !== "-") {
        throw new Error(`invalid Unary operator at ${path}`);
      }
      return {
        type: "Unary",
        op: expression.op,
        argument: parseBehaviorExpression(expression.argument, `${path}.argument`),
      };
    case "Binary":
      if (typeof expression.op !== "string" || !BINARY_OPERATORS.has(expression.op)) {
        throw new Error(`invalid Binary operator at ${path}`);
      }
      return {
        type: "Binary",
        op: expression.op,
        left: parseBehaviorExpression(expression.left, `${path}.left`),
        right: parseBehaviorExpression(expression.right, `${path}.right`),
      };
    case "Call":
      if (
        typeof expression.callee !== "string" ||
        expression.callee.length === 0 ||
        !Array.isArray(expression.args)
      ) {
        throw new Error(`invalid Call expression at ${path}`);
      }
      return {
        type: "Call",
        callee: expression.callee,
        args: expression.args.map((arg, index) =>
          parseBehaviorNamedArg(arg, `${path}.args[${index}]`),
        ),
      };
    default:
      throw new Error(`unsupported expression at ${path}`);
  }
}

export function parseBehaviorRoot(value: unknown): BehaviorBlock {
  if (typeof value !== "object" || value === null) {
    throw new Error("behavior must be an object");
  }

  const root = value as Partial<BehaviorBlock>;
  if (root.type !== "Block" || !Array.isArray(root.statements)) {
    throw new Error('behavior root must be { type: "Block", statements: [] }');
  }

  return {
    type: "Block",
    statements: parseBehaviorStatements(root.statements, 0, "behavior.statements"),
  };
}
