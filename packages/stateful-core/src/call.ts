import type { FrameContext, StatefulRegistry, StatefulValue } from "./types.js";
import type { StatefulStore } from "./store.js";

export function callStatefulFunction(
  registry: StatefulRegistry,
  store: StatefulStore,
  frame: FrameContext,
  functionName: string,
  namedArgs: Record<string, number | string | boolean>,
  inputValue = 0,
): StatefulValue | undefined {
  if (!registry.get(functionName)) {
    return undefined;
  }

  let input = inputValue;
  const config: Record<string, number | string> = {};

  for (const [key, raw] of Object.entries(namedArgs)) {
    if (key === "id") {
      continue;
    }
    if (key === "value" || key === "target") {
      input = typeof raw === "number" ? raw : Number(raw) || 0;
      continue;
    }
    if (typeof raw === "boolean") {
      config[key] = raw ? 1 : 0;
      continue;
    }
    config[key] = raw;
  }

  const instanceId = String(namedArgs.id ?? functionName);
  return store.evaluate(functionName, instanceId, config, input, frame, registry);
}

export function evaluateStatefulGraphNode(
  functionName: string,
  nodeData: Record<string, unknown>,
  nodeId: string,
  input: number,
  frame: FrameContext,
  store: StatefulStore,
  registry: StatefulRegistry,
): number {
  const instanceId = String(nodeData.stateId ?? nodeId);
  const config: Record<string, number | string> = {};

  for (const [key, value] of Object.entries(nodeData)) {
    if (key === "stateId" || key === "label") {
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      config[key] = value;
    }
    if (typeof value === "string" && key !== "label") {
      config[key] = value;
    }
  }

  const result = store.evaluate(functionName, instanceId, config, input, frame, registry);
  return typeof result === "boolean" ? (result ? 1 : 0) : result;
}
