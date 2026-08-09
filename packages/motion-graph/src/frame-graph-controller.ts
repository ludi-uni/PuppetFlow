import {
  parseMotionFrameGraph,
  type MotionFrameGraphCondition,
  type MotionFrameGraphDocument,
  type MotionGraphSignalValue,
  type MotionSourcePolicyOverride,
} from "./frame-graph-types.js";

export interface MotionFrameGraphSourceStatus {
  connected: boolean;
  stale: boolean;
}

export interface MotionFrameGraphEvaluationContext {
  sources: Readonly<Record<string, MotionFrameGraphSourceStatus>>;
}

export interface MotionFrameGraphSnapshot {
  stateId: string;
  enteredAt: number;
  policy: Readonly<Record<string, MotionSourcePolicyOverride>>;
}

export interface MotionFrameGraphController {
  setSignal(key: string, value: MotionGraphSignalValue): void;
  evaluate(context: MotionFrameGraphEvaluationContext): MotionFrameGraphSnapshot;
  snapshot(): MotionFrameGraphSnapshot;
  reset(): void;
}

type Clock = () => number;

function monotonicNow(): number {
  const performance = (
    globalThis as typeof globalThis & {
      performance?: { now(): number };
    }
  ).performance;
  return performance ? performance.now() : Date.now();
}

function clonePolicy(
  policy: Readonly<Record<string, MotionSourcePolicyOverride>> | undefined,
): Readonly<Record<string, MotionSourcePolicyOverride>> {
  return Object.fromEntries(
    Object.entries(policy ?? {}).map(([sourceId, override]) => [
      sourceId,
      { ...override },
    ]),
  );
}

function cloneSnapshot(
  state: { id: string; sources?: Readonly<Record<string, MotionSourcePolicyOverride>> },
  enteredAt: number,
): MotionFrameGraphSnapshot {
  return {
    stateId: state.id,
    enteredAt,
    policy: clonePolicy(state.sources),
  };
}

function matchesCondition(
  condition: MotionFrameGraphCondition,
  context: MotionFrameGraphEvaluationContext,
  signals: ReadonlyMap<string, MotionGraphSignalValue>,
  elapsedMs: number,
): boolean {
  switch (condition.type) {
    case "signal":
      return matchesSignal(condition, signals.get(condition.key));
    case "source": {
      if (!Object.prototype.hasOwnProperty.call(context.sources, condition.sourceId)) {
        return false;
      }
      const source = context.sources[condition.sourceId];
      return (
        source !== undefined &&
        Object.prototype.hasOwnProperty.call(source, condition.field) &&
        source[condition.field] === condition.equals
      );
    }
    case "elapsed":
      return elapsedMs >= condition.minimumMs;
  }
}

function matchesSignal(
  condition: Extract<MotionFrameGraphCondition, { type: "signal" }>,
  actual: MotionGraphSignalValue | undefined,
): boolean {
  if (actual === undefined) return false;
  if (condition.operator === "equals") return actual === condition.value;
  if (condition.operator === "notEquals") return actual !== condition.value;

  if (typeof actual !== "number" || !Number.isFinite(actual)) return false;
  if (typeof condition.value !== "number" || !Number.isFinite(condition.value))
    return false;
  switch (condition.operator) {
    case "gt":
      return actual > condition.value;
    case "gte":
      return actual >= condition.value;
    case "lt":
      return actual < condition.value;
    case "lte":
      return actual <= condition.value;
  }
}

export function createMotionFrameGraphController(
  input: MotionFrameGraphDocument,
  options: { now?: Clock } = {},
): MotionFrameGraphController {
  const document = parseMotionFrameGraph(input);
  const now = options.now ?? monotonicNow;
  const states = new Map(document.states.map((state) => [state.id, state]));
  const signals = new Map<string, MotionGraphSignalValue>();
  let stateId = document.initialState;
  let enteredAt = now();

  return {
    setSignal(key, value) {
      if (!key.trim()) throw new Error("Motion graph signal key must be non-empty");
      signals.set(key, value);
    },
    evaluate(context) {
      const currentTime = now();
      const transition = document.transitions?.find(
        (candidate) =>
          candidate.from === stateId &&
          matchesCondition(candidate.when, context, signals, currentTime - enteredAt),
      );
      if (transition) {
        stateId = transition.to;
        enteredAt = currentTime;
      }
      return cloneSnapshot(states.get(stateId)!, enteredAt);
    },
    snapshot() {
      return cloneSnapshot(states.get(stateId)!, enteredAt);
    },
    reset() {
      signals.clear();
      stateId = document.initialState;
      enteredAt = now();
    },
  };
}
