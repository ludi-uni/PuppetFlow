import { clamp01, MOTION_STATE_KEYS, type MotionState } from "@puppetflow/core";
import type {
  BehaviorBlock,
  BehaviorCondition,
  BehaviorExprCondition,
  BehaviorMotionPack,
  BehaviorStatement,
  CompareCondition,
  StringCompareCondition,
} from "./ast.js";
import { applyAssign } from "./builtins.js";
import { evaluateExpression, evaluateExpressionAsNumber } from "./evaluate-expr.js";
import { LocalScopeStack } from "./local-scope.js";
import { parseAssignTarget } from "./motion-aliases.js";
import type { BehaviorExecutionContext } from "./context.js";
import type { BehaviorValue } from "./expr.js";
import {
  resolveCurrentPhoneme,
  resolveNumericIdentifier,
  resolveStringIdentifier,
} from "./resolve-context.js";

export interface BehaviorMotionPackInvocation {
  packId: string;
  config?: Record<string, number>;
}

export interface BehaviorExecutionResult {
  motion: Partial<MotionState>;
  packInvocations: BehaviorMotionPackInvocation[];
}

function evaluateCompare(
  ctx: BehaviorExecutionContext,
  condition: CompareCondition,
  locals: ReadonlyMap<string, BehaviorValue>,
): boolean {
  const local = locals.get(condition.left);
  const left =
    local === undefined
      ? resolveNumericIdentifier(condition.left, ctx)
      : typeof local === "number"
        ? local
        : Number(local) || 0;

  switch (condition.op) {
    case ">":
      return left > condition.right;
    case ">=":
      return left >= condition.right;
    case "<":
      return left < condition.right;
    case "<=":
      return left <= condition.right;
    case "==":
      return left === condition.right;
    case "!=":
      return left !== condition.right;
    default:
      return false;
  }
}

function evaluateStringCompare(
  ctx: BehaviorExecutionContext,
  condition: StringCompareCondition,
  locals: ReadonlyMap<string, BehaviorValue>,
): boolean {
  const local = locals.get(condition.left);
  const left =
    local === undefined
      ? condition.left === "currentPhoneme"
        ? resolveCurrentPhoneme(ctx)
        : resolveStringIdentifier(condition.left, ctx)
      : String(local);

  switch (condition.op) {
    case "==":
      return left === condition.right;
    case "!=":
      return left !== condition.right;
    default:
      return false;
  }
}

function isStringCompareCondition(
  condition: BehaviorCondition,
): condition is StringCompareCondition {
  return "kind" in condition && condition.kind === "StringCompare";
}

function isCompareCondition(
  condition: BehaviorCondition,
): condition is CompareCondition {
  return (
    "left" in condition && typeof (condition as CompareCondition).right === "number"
  );
}

function isExprCondition(
  condition: BehaviorCondition,
): condition is BehaviorExprCondition {
  return "kind" in condition && condition.kind === "Expr";
}

function evaluateCondition(
  ctx: BehaviorExecutionContext,
  condition: BehaviorCondition,
  locals: ReadonlyMap<string, BehaviorValue>,
): boolean {
  if (isExprCondition(condition)) {
    return Boolean(evaluateExpression(condition.expression, ctx, locals));
  }

  if (isStringCompareCondition(condition)) {
    return evaluateStringCompare(ctx, condition, locals);
  }

  if (isCompareCondition(condition)) {
    return evaluateCompare(ctx, condition, locals);
  }

  switch (condition.type) {
    case "And":
      return condition.conditions.every((item) => evaluateCondition(ctx, item, locals));
    case "Or":
      return condition.conditions.some((item) => evaluateCondition(ctx, item, locals));
    case "Not":
      return !evaluateCondition(ctx, condition.condition, locals);
    default:
      return false;
  }
}

function applyExprAssign(
  statement: Extract<BehaviorStatement, { type: "ExprAssign" }>,
  ctx: BehaviorExecutionContext,
  locals: LocalScopeStack,
): Partial<MotionState> {
  const value = clamp01(
    evaluateExpressionAsNumber(statement.value, ctx, locals.snapshot()),
  );
  const target = parseAssignTarget(statement.target);

  if (typeof target === "string") {
    return applyAssign({}, target, "set", value);
  }

  return {
    custom: {
      [target.custom]: value,
    },
  };
}

function recordMotionPack(
  statement: BehaviorMotionPack,
  packInvocations: BehaviorMotionPackInvocation[],
): void {
  packInvocations.push({
    packId: statement.packId,
    config: statement.config,
  });
}

function executeStatements(
  statements: BehaviorStatement[],
  ctx: BehaviorExecutionContext,
  path: string,
  packInvocations: BehaviorMotionPackInvocation[],
  locals: LocalScopeStack,
): Partial<MotionState>[] {
  const outputs: Partial<MotionState>[] = [];

  statements.forEach((statement, index) => {
    const instanceKey = `${path}/${index}`;
    outputs.push(
      executeStatement(statement, ctx, instanceKey, packInvocations, locals),
    );
  });

  return outputs;
}

function executeStatement(
  statement: BehaviorStatement,
  ctx: BehaviorExecutionContext,
  instanceKey: string,
  packInvocations: BehaviorMotionPackInvocation[],
  locals: LocalScopeStack,
): Partial<MotionState> {
  switch (statement.type) {
    case "Block":
      return mergePartials(
        executeStatements(
          statement.statements,
          ctx,
          instanceKey,
          packInvocations,
          locals,
        ),
      );
    case "If": {
      const branch = evaluateCondition(ctx, statement.condition, locals.snapshot())
        ? statement.then
        : (statement.else ?? []);
      locals.push();
      try {
        return mergePartials(
          executeStatements(branch, ctx, instanceKey, packInvocations, locals),
        );
      } finally {
        locals.pop();
      }
    }
    case "Assign":
      return applyAssign({}, statement.key, statement.op, statement.value);
    case "ExprAssign":
      return applyExprAssign(statement, ctx, locals);
    case "LocalLet":
      locals.declare(
        statement.name,
        evaluateExpression(statement.value, ctx, locals.snapshot()),
      );
      return {};
    case "LocalAssign": {
      const value = evaluateExpression(statement.value, ctx, locals.snapshot());
      if (!locals.set(statement.name, value)) {
        throw new Error(
          `LocalAssign cannot update undeclared local \"${statement.name}\" at ${instanceKey}`,
        );
      }
      return {};
    }
    case "MotionPack":
      recordMotionPack(statement, packInvocations);
      return {};
    default:
      return {};
  }
}

function mergePartials(partials: Partial<MotionState>[]): Partial<MotionState> {
  if (partials.length === 0) {
    return {};
  }

  const result: Partial<MotionState> = {};

  for (const partial of partials) {
    for (const key of MOTION_STATE_KEYS) {
      if (partial[key] !== undefined) {
        result[key] = partial[key];
      }
    }

    if (partial.custom) {
      result.custom = { ...result.custom };
      for (const [key, value] of Object.entries(partial.custom)) {
        result.custom[key] = value;
      }
    }
  }

  return result;
}

export function executeBehaviorWithInvocations(
  root: BehaviorBlock,
  ctx: BehaviorExecutionContext,
): BehaviorExecutionResult {
  const packInvocations: BehaviorMotionPackInvocation[] = [];
  const locals = new LocalScopeStack();
  const partials = executeStatements(
    root.statements,
    ctx,
    "root",
    packInvocations,
    locals,
  );
  return {
    motion: mergePartials(partials),
    packInvocations,
  };
}

export function executeBehavior(
  root: BehaviorBlock,
  ctx: BehaviorExecutionContext,
): Partial<MotionState> {
  return executeBehaviorWithInvocations(root, ctx).motion;
}
