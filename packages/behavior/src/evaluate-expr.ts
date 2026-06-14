import type { ChannelStore, StateStore } from "@puppetflow/core";
import type { BehaviorExecutionContext } from "./context.js";
import type { BehaviorExpression, BehaviorNamedArgExpr } from "./expr.js";
import { callBuiltinFunction } from "./builtin-functions.js";
import { callStatefulFunction } from "@puppetflow/stateful-core";
import {
  resolveActiveTimelineEventIds,
  resolveCurrentPhoneme,
  resolveNumericIdentifier,
} from "./resolve-context.js";

export function evaluateExpression(
  expression: BehaviorExpression,
  ctx: BehaviorExecutionContext,
): number | string | boolean {
  switch (expression.type) {
    case "Number":
      return expression.value;
    case "String":
      return expression.value;
    case "Boolean":
      return expression.value;
    case "Identifier":
      return resolveIdentifier(expression.name, ctx);
    case "Unary": {
      const value = evaluateExpression(expression.argument, ctx);
      if (expression.op === "not") {
        return !value;
      }
      if (typeof value !== "number") {
        return 0;
      }
      return -value;
    }
    case "Binary": {
      const left = evaluateExpression(expression.left, ctx);
      const right = evaluateExpression(expression.right, ctx);
      return evaluateBinary(expression.op, left, right);
    }
    case "Call":
      return evaluateCall(expression.callee, expression.args, ctx);
    default:
      return 0;
  }
}

function resolveIdentifier(
  name: string,
  ctx: BehaviorExecutionContext,
): number | string | boolean {
  if (name === "currentPhoneme") {
    return resolveCurrentPhoneme(ctx);
  }
  return resolveNumericIdentifier(name, ctx);
}

function evaluateBinary(
  op: string,
  left: number | string | boolean,
  right: number | string | boolean,
): number | boolean {
  if (op === "and") {
    return Boolean(left) && Boolean(right);
  }
  if (op === "or") {
    return Boolean(left) || Boolean(right);
  }

  const leftNumber = typeof left === "number" ? left : Number(left);
  const rightNumber = typeof right === "number" ? right : Number(right);

  switch (op) {
    case "+":
      return leftNumber + rightNumber;
    case "-":
      return leftNumber - rightNumber;
    case "*":
      return leftNumber * rightNumber;
    case "/":
      return rightNumber === 0 ? 0 : leftNumber / rightNumber;
    case "%":
      return rightNumber === 0 ? 0 : leftNumber % rightNumber;
    case ">":
      return leftNumber > rightNumber;
    case ">=":
      return leftNumber >= rightNumber;
    case "<":
      return leftNumber < rightNumber;
    case "<=":
      return leftNumber <= rightNumber;
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    default:
      return 0;
  }
}

function evaluateCall(
  callee: string,
  args: BehaviorNamedArgExpr[],
  ctx: BehaviorExecutionContext,
): number | string | boolean {
  const namedRecord: Record<string, number | string | boolean> = {};
  let inputValue = 0;

  for (const arg of args) {
    const value = evaluateExpression(arg.value, ctx);
    if (!arg.name) {
      continue;
    }
    if (arg.name === "value" || arg.name === "target") {
      inputValue = typeof value === "number" ? value : Number(value) || 0;
      continue;
    }
    if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
      namedRecord[arg.name] = value;
    }
  }

  if (ctx.statefulStore && ctx.statefulRegistry && ctx.frame) {
    const statefulResult = callStatefulFunction(
      ctx.statefulRegistry,
      ctx.statefulStore,
      ctx.frame,
      callee,
      namedRecord,
      inputValue,
    );
    if (statefulResult !== undefined) {
      return statefulResult;
    }
  }

  const positional = args.filter((arg) => !arg.name).map((arg) => evaluateExpression(arg.value, ctx));
  const named = args.filter((arg) => arg.name);
  const evaluatedArgs =
    named.length === 0
      ? positional
      : named.map((arg) => evaluateExpression(arg.value, ctx));

  if (callee === "eventActive") {
    const eventName = evaluatedArgs[0];
    if (typeof eventName !== "string") {
      return false;
    }
    const activeIds = resolveActiveTimelineEventIds(ctx.activeTimelineEvents);
    return activeIds.includes(eventName);
  }

  return callBuiltinFunction(callee, evaluatedArgs);
}

export function evaluateExpressionAsNumber(
  expression: BehaviorExpression,
  ctx: BehaviorExecutionContext,
): number {
  const value = evaluateExpression(expression, ctx);
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function evaluateExpressionAsString(
  expression: BehaviorExpression,
  ctx: BehaviorExecutionContext,
): string {
  const value = evaluateExpression(expression, ctx);
  return typeof value === "string" ? value : String(value);
}

export type { ChannelStore, StateStore };
