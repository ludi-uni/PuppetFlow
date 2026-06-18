import { clamp01, MOTION_STATE_KEYS, type MotionState } from "@puppetflow/core";
import type {
  BehaviorBlock,
  BehaviorCondition,
  BehaviorMotionPack,
  BehaviorStatement,
  CompareCondition,
  StringCompareCondition,
} from "./ast.js";
import { applyAssign } from "./builtins.js";
import { evaluateExpression, evaluateExpressionAsNumber } from "./evaluate-expr.js";
import { parseAssignTarget } from "./motion-aliases.js";
import type { BehaviorExecutionContext } from "./context.js";
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
): boolean {
  const left = resolveNumericIdentifier(condition.left, ctx);

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
): boolean {
  const left =
    condition.left === "currentPhoneme"
      ? resolveCurrentPhoneme(ctx)
      : resolveStringIdentifier(condition.left, ctx);

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

import type { BehaviorExprCondition } from "./ast.js";

function isExprCondition(
  condition: BehaviorCondition,
): condition is BehaviorExprCondition {
  return "kind" in condition && condition.kind === "Expr";
}

function evaluateCondition(
  ctx: BehaviorExecutionContext,
  condition: BehaviorCondition,
): boolean {
  if (isExprCondition(condition)) {
    return Boolean(evaluateExpression(condition.expression, ctx));
  }

  if (isStringCompareCondition(condition)) {
    return evaluateStringCompare(ctx, condition);
  }

  if (isCompareCondition(condition)) {
    return evaluateCompare(ctx, condition);
  }

  switch (condition.type) {
    case "And":
      return condition.conditions.every((item) => evaluateCondition(ctx, item));
    case "Or":
      return condition.conditions.some((item) => evaluateCondition(ctx, item));
    case "Not":
      return !evaluateCondition(ctx, condition.condition);
    default:
      return false;
  }
}

function applyExprAssign(
  statement: Extract<BehaviorStatement, { type: "ExprAssign" }>,
  ctx: BehaviorExecutionContext,
): Partial<MotionState> {
  const value = clamp01(evaluateExpressionAsNumber(statement.value, ctx));
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
): Partial<MotionState>[] {
  const outputs: Partial<MotionState>[] = [];

  statements.forEach((statement, index) => {
    const instanceKey = `${path}/${index}`;
    outputs.push(executeStatement(statement, ctx, instanceKey, packInvocations));
  });

  return outputs;
}

function executeStatement(
  statement: BehaviorStatement,
  ctx: BehaviorExecutionContext,
  instanceKey: string,
  packInvocations: BehaviorMotionPackInvocation[],
): Partial<MotionState> {
  switch (statement.type) {
    case "Block":
      return mergePartials(
        executeStatements(statement.statements, ctx, instanceKey, packInvocations),
      );
    case "If": {
      const branch = evaluateCondition(ctx, statement.condition)
        ? statement.then
        : (statement.else ?? []);
      return mergePartials(
        executeStatements(branch, ctx, instanceKey, packInvocations),
      );
    }
    case "Assign":
      return applyAssign({}, statement.key, statement.op, statement.value);
    case "ExprAssign":
      return applyExprAssign(statement, ctx);
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
  const partials = executeStatements(root.statements, ctx, "root", packInvocations);
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
