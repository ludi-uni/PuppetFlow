import { MOTION_STATE_KEYS, type MotionStateKey } from "@puppetflow/core";

const BUILTIN_IDS = new Set<BehaviorBuiltin["id"]>([
  "gaze",
  "blink",
  "idle",
  "attention",
  "emotion",
]);
const COMPARE_OPS = new Set<CompareOp>([">", ">=", "<", "<=", "==", "!="]);
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

export type BehaviorCondition = CompareCondition | LogicAnd | LogicOr | LogicNot;

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

export interface BehaviorBuiltin {
  type: "Builtin";
  id: "gaze" | "blink" | "idle" | "attention" | "emotion";
  config?: Record<string, unknown>;
}

export type BehaviorStatement =
  | BehaviorBlock
  | BehaviorIf
  | BehaviorAssign
  | BehaviorBuiltin;

export function isBehaviorCondition(value: unknown): value is BehaviorCondition {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if ("left" in value && "op" in value && "right" in value) {
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
    const condition = value as Partial<CompareCondition>;
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
    case "Builtin": {
      if (
        typeof statement.id !== "string" ||
        !BUILTIN_IDS.has(statement.id as BehaviorBuiltin["id"])
      ) {
        throw new Error(`invalid Builtin statement at ${path}`);
      }
      const config = statement.config;
      return {
        type: "Builtin",
        id: statement.id as BehaviorBuiltin["id"],
        config:
          config === undefined
            ? undefined
            : typeof config === "object" && config !== null
              ? (config as Record<string, unknown>)
              : (() => {
                  throw new Error(`Builtin config must be an object at ${path}`);
                })(),
      };
    }
    default:
      throw new Error(`unsupported behavior statement at ${path}`);
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
