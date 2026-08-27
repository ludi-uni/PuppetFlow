import type { ChannelStore, StateStore } from "@puppetflow/core";
import type { BehaviorExecutionContext } from "./context.js";
import type {
  BehaviorExpression,
  BehaviorNamedArgExpr,
  BehaviorValue,
} from "./expr.js";
import { callBuiltinFunction } from "./builtin-functions.js";
import { isPfScriptBuiltinFunction } from "./pfscript-function-catalog.js";
import { callStatefulFunction } from "@puppetflow/stateful-core";
import {
  resolveActiveTimelineEventIds,
  resolveCurrentPhoneme,
  resolveNumericIdentifier,
} from "./resolve-context.js";

export function evaluateExpression(
  expression: BehaviorExpression,
  ctx: BehaviorExecutionContext,
  locals?: ReadonlyMap<string, BehaviorValue>,
): BehaviorValue {
  switch (expression.type) {
    case "Number":
      return expression.value;
    case "String":
      return expression.value;
    case "Boolean":
      return expression.value;
    case "Identifier":
      return resolveIdentifier(expression.name, ctx, locals);
    case "Unary": {
      const value = evaluateExpression(expression.argument, ctx, locals);
      if (expression.op === "not") {
        return !value;
      }
      if (typeof value !== "number") {
        return 0;
      }
      return -value;
    }
    case "Binary": {
      const left = evaluateExpression(expression.left, ctx, locals);
      const right = evaluateExpression(expression.right, ctx, locals);
      return evaluateBinary(expression.op, left, right);
    }
    case "Call":
      return evaluateCall(expression.callee, expression.args, ctx, locals);
    default:
      return 0;
  }
}

function resolveIdentifier(
  name: string,
  ctx: BehaviorExecutionContext,
  locals?: ReadonlyMap<string, BehaviorValue>,
): BehaviorValue {
  const local = locals?.get(name);
  if (local !== undefined) {
    return local;
  }
  if (name === "currentPhoneme") {
    return resolveCurrentPhoneme(ctx);
  }
  return resolveNumericIdentifier(name, ctx);
}

function evaluateBinary(
  op: string,
  left: BehaviorValue,
  right: BehaviorValue,
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
  locals?: ReadonlyMap<string, BehaviorValue>,
): BehaviorValue {
  const evaluatedArgs = args.map((arg) => ({
    name: arg.name,
    value: evaluateExpression(arg.value, ctx, locals),
  }));
  const namedRecord: Record<string, BehaviorValue> = {};
  const extensionArgs: Record<string, number> = {};
  let inputValue = 0;

  for (const arg of evaluatedArgs) {
    if (!arg.name) {
      continue;
    }
    if (typeof arg.value === "number" && Number.isFinite(arg.value)) {
      extensionArgs[arg.name] = arg.value;
    }
    if (arg.name === "value" || arg.name === "target") {
      inputValue = typeof arg.value === "number" ? arg.value : Number(arg.value) || 0;
      continue;
    }
    if (
      typeof arg.value === "number" ||
      typeof arg.value === "string" ||
      typeof arg.value === "boolean"
    ) {
      namedRecord[arg.name] = arg.value;
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

  const positional = evaluatedArgs.filter((arg) => !arg.name).map((arg) => arg.value);
  const named = evaluatedArgs.filter((arg) => arg.name).map((arg) => arg.value);
  const builtinArgs = named.length === 0 ? positional : named;

  if (callee === "eventActive") {
    const eventName = builtinArgs[0];
    if (typeof eventName !== "string") {
      return false;
    }
    const activeIds = resolveActiveTimelineEventIds(ctx.activeTimelineEvents);
    return activeIds.includes(eventName);
  }

  if (isPfScriptBuiltinFunction(callee)) {
    return callBuiltinFunction(callee, builtinArgs);
  }

  const extensionResult = ctx.evaluateExtensionFunction?.(callee, extensionArgs);
  if (extensionResult !== undefined) {
    return extensionResult;
  }

  return callBuiltinFunction(callee, builtinArgs);
}

export function evaluateExpressionAsNumber(
  expression: BehaviorExpression,
  ctx: BehaviorExecutionContext,
  locals?: ReadonlyMap<string, BehaviorValue>,
): number {
  const value = evaluateExpression(expression, ctx, locals);
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
