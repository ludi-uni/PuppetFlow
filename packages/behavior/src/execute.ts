import {
  mergeMotionState,
  createEmptyMotionState,
  type MotionState,
} from "@puppetflow/core";
import type { ChannelStore, StateStore } from "@puppetflow/core";
import type {
  BehaviorBlock,
  BehaviorCondition,
  BehaviorStatement,
  CompareCondition,
} from "./ast.js";
import { applyAssign } from "./builtins.js";

export interface BehaviorExecutionContext {
  state: StateStore;
  channels: ChannelStore;
  renderedMotion: MotionState;
  deltaTime: number;
}

function evaluateCompare(state: StateStore, condition: CompareCondition): boolean {
  const raw = state.get(condition.left);
  const left = typeof raw === "number" ? raw : 0;

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

function evaluateCondition(state: StateStore, condition: BehaviorCondition): boolean {
  if ("left" in condition) {
    return evaluateCompare(state, condition);
  }

  switch (condition.type) {
    case "And":
      return condition.conditions.every((item) => evaluateCondition(state, item));
    case "Or":
      return condition.conditions.some((item) => evaluateCondition(state, item));
    case "Not":
      return !evaluateCondition(state, condition.condition);
    default:
      return false;
  }
}

function executeStatements(
  statements: BehaviorStatement[],
  ctx: BehaviorExecutionContext,
  path: string,
): Partial<MotionState>[] {
  const outputs: Partial<MotionState>[] = [];

  statements.forEach((statement, index) => {
    const instanceKey = `${path}/${index}`;
    outputs.push(executeStatement(statement, ctx, instanceKey));
  });

  return outputs;
}

function executeStatement(
  statement: BehaviorStatement,
  ctx: BehaviorExecutionContext,
  instanceKey: string,
): Partial<MotionState> {
  switch (statement.type) {
    case "Block":
      return mergePartials(executeStatements(statement.statements, ctx, instanceKey));
    case "If": {
      const branch = evaluateCondition(ctx.state, statement.condition)
        ? statement.then
        : (statement.else ?? []);
      return mergePartials(executeStatements(branch, ctx, instanceKey));
    }
    case "Assign":
      return applyAssign({}, statement.key, statement.op, statement.value);
    case "MotionPack":
      return {};
    default:
      return {};
  }
}

function mergePartials(partials: Partial<MotionState>[]): Partial<MotionState> {
  if (partials.length === 0) {
    return {};
  }

  return mergeMotionState(createEmptyMotionState(), partials);
}

export function executeBehavior(
  root: BehaviorBlock,
  ctx: BehaviorExecutionContext,
): Partial<MotionState> {
  const partials = executeStatements(root.statements, ctx, "root");
  return mergePartials(partials);
}
