export type MotionGraphSignalValue = string | number | boolean;

export interface MotionSourcePolicyOverride {
  enabled?: boolean;
  priority?: number;
  weight?: number;
}

export interface MotionFrameGraphStateDefinition {
  id: string;
  sources?: Readonly<Record<string, MotionSourcePolicyOverride>>;
}

export type MotionFrameGraphCondition =
  | {
      type: "signal";
      key: string;
      operator: "equals" | "notEquals" | "gt" | "gte" | "lt" | "lte";
      value: MotionGraphSignalValue;
    }
  | {
      type: "source";
      sourceId: string;
      field: "connected" | "stale";
      equals: boolean;
    }
  | {
      type: "elapsed";
      minimumMs: number;
    };

export interface MotionFrameGraphTransition {
  from: string;
  to: string;
  when: MotionFrameGraphCondition;
}

export interface MotionFrameGraphDocument {
  version: 1;
  initialState: string;
  states: readonly MotionFrameGraphStateDefinition[];
  transitions?: readonly MotionFrameGraphTransition[];
}

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`MotionFrameGraph.${field} must be a non-empty string`);
  }
  return value;
}

function parsePolicy(value: unknown, sourceId: string): MotionSourcePolicyOverride {
  if (!isRecord(value)) {
    throw new Error(`MotionFrameGraph source policy must be an object: ${sourceId}`);
  }

  const policy: MotionSourcePolicyOverride = {};
  if ("enabled" in value) {
    if (typeof value.enabled !== "boolean") {
      throw new Error(
        `MotionFrameGraph source policy enabled must be a boolean: ${sourceId}`,
      );
    }
    policy.enabled = value.enabled;
  }
  if ("priority" in value) {
    if (typeof value.priority !== "number" || !Number.isFinite(value.priority)) {
      throw new Error(
        `MotionFrameGraph source policy priority must be finite: ${sourceId}`,
      );
    }
    policy.priority = value.priority;
  }
  if ("weight" in value) {
    if (
      typeof value.weight !== "number" ||
      !Number.isFinite(value.weight) ||
      value.weight < 0 ||
      value.weight > 1
    ) {
      throw new Error(
        `MotionFrameGraph source policy weight must be between 0 and 1: ${sourceId}`,
      );
    }
    policy.weight = value.weight;
  }
  return policy;
}

function parseState(value: unknown): MotionFrameGraphStateDefinition {
  if (!isRecord(value)) {
    throw new Error("MotionFrameGraph state must be an object");
  }

  const id = requireNonEmptyString(value.id, "state.id");
  let sources: Record<string, MotionSourcePolicyOverride> | undefined;
  if (value.sources !== undefined) {
    if (!isRecord(value.sources)) {
      throw new Error(`MotionFrameGraph state sources must be an object: ${id}`);
    }
    sources = {};
    for (const [sourceId, policy] of Object.entries(value.sources)) {
      if (!sourceId.trim()) {
        throw new Error(`MotionFrameGraph source ID must be a non-empty string: ${id}`);
      }
      Object.defineProperty(sources, sourceId, {
        configurable: true,
        enumerable: true,
        value: parsePolicy(policy, sourceId),
        writable: true,
      });
    }
  }
  return { id, ...(sources ? { sources } : {}) };
}

function parseSignalValue(value: unknown): MotionGraphSignalValue {
  if (
    (typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean") ||
    (typeof value === "number" && !Number.isFinite(value))
  ) {
    throw new Error("MotionFrameGraph signal value must be a primitive");
  }
  return value;
}

function parseCondition(value: unknown): MotionFrameGraphCondition {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new Error("MotionFrameGraph condition must have a supported type");
  }

  if (value.type === "signal") {
    const key = requireNonEmptyString(value.key, "condition.key");
    const operators = ["equals", "notEquals", "gt", "gte", "lt", "lte"] as const;
    if (!operators.includes(value.operator as (typeof operators)[number])) {
      throw new Error("MotionFrameGraph condition operator is invalid");
    }
    return {
      type: "signal",
      key,
      operator: value.operator as (typeof operators)[number],
      value: parseSignalValue(value.value),
    };
  }

  if (value.type === "source") {
    const sourceId = requireNonEmptyString(value.sourceId, "condition.sourceId");
    if (value.field !== "connected" && value.field !== "stale") {
      throw new Error("MotionFrameGraph source condition field is invalid");
    }
    if (typeof value.equals !== "boolean") {
      throw new Error("MotionFrameGraph source condition equals must be a boolean");
    }
    return { type: "source", sourceId, field: value.field, equals: value.equals };
  }

  if (value.type === "elapsed") {
    if (
      typeof value.minimumMs !== "number" ||
      !Number.isFinite(value.minimumMs) ||
      value.minimumMs < 0
    ) {
      throw new Error("MotionFrameGraph.minimumMs must be finite and non-negative");
    }
    return { type: "elapsed", minimumMs: value.minimumMs };
  }

  throw new Error("MotionFrameGraph condition type is invalid");
}

function parseTransition(value: unknown): MotionFrameGraphTransition {
  if (!isRecord(value)) {
    throw new Error("MotionFrameGraph transition must be an object");
  }
  return {
    from: requireNonEmptyString(value.from, "transition.from"),
    to: requireNonEmptyString(value.to, "transition.to"),
    when: parseCondition(value.when),
  };
}

export function parseMotionFrameGraph(value: unknown): MotionFrameGraphDocument {
  if (!isRecord(value) || value.version !== 1) {
    throw new Error("MotionFrameGraph.version must be 1");
  }
  const initialState = requireNonEmptyString(value.initialState, "initialState");
  if (!Array.isArray(value.states) || value.states.length === 0) {
    throw new Error("MotionFrameGraph.states must be a non-empty array");
  }

  const states = value.states.map(parseState);
  const stateIds = new Set<string>();
  for (const state of states) {
    if (stateIds.has(state.id)) {
      throw new Error(`MotionFrameGraph contains duplicate state: ${state.id}`);
    }
    stateIds.add(state.id);
  }
  if (!stateIds.has(initialState)) {
    throw new Error(`MotionFrameGraph.initialState is unknown: ${initialState}`);
  }

  if (value.transitions !== undefined && !Array.isArray(value.transitions)) {
    throw new Error("MotionFrameGraph.transitions must be an array when provided");
  }
  const transitions = (value.transitions ?? []).map(parseTransition);
  for (const transition of transitions) {
    if (!stateIds.has(transition.from) || !stateIds.has(transition.to)) {
      throw new Error("MotionFrameGraph transition references an unknown state");
    }
  }
  return { version: 1, initialState, states, transitions };
}
