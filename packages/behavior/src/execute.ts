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
import { applyAssign, executeBuiltin, type BuiltinStateStore } from "./builtins.js";

export interface BehaviorExecutionContext {
  state: StateStore;
  channels: ChannelStore;
  renderedMotion: MotionState;
  deltaTime: number;
  builtinStates?: BuiltinStateStore;
}

class MapBuiltinStateStore implements BuiltinStateStore {
  private readonly map = new Map<string, unknown>();

  get<T>(key: string): T | undefined {
    return this.map.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    this.map.set(key, value);
  }
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
  builtinStates: BuiltinStateStore,
  path: string,
): Partial<MotionState>[] {
  const outputs: Partial<MotionState>[] = [];

  statements.forEach((statement, index) => {
    const instanceKey = `${path}/${index}`;
    outputs.push(executeStatement(statement, ctx, builtinStates, instanceKey));
  });

  return outputs;
}

function executeStatement(
  statement: BehaviorStatement,
  ctx: BehaviorExecutionContext,
  builtinStates: BuiltinStateStore,
  instanceKey: string,
): Partial<MotionState> {
  switch (statement.type) {
    case "Block":
      return mergePartials(
        executeStatements(statement.statements, ctx, builtinStates, instanceKey),
      );
    case "If": {
      const branch = evaluateCondition(ctx.state, statement.condition)
        ? statement.then
        : (statement.else ?? []);
      return mergePartials(executeStatements(branch, ctx, builtinStates, instanceKey));
    }
    case "Assign":
      return applyAssign({}, statement.key, statement.op, statement.value);
    case "Builtin":
      return executeBuiltin(statement, {
        state: ctx.state,
        renderedMotion: ctx.renderedMotion,
        deltaTime: ctx.deltaTime,
        states: builtinStates,
        instanceKey,
      });
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
  const builtinStates = ctx.builtinStates ?? new MapBuiltinStateStore();
  const partials = executeStatements(root.statements, ctx, builtinStates, "root");
  return mergePartials(partials);
}
