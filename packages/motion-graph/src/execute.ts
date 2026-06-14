import {
  clamp01,
  mergeMotionState,
  createEmptyMotionState,
  MOTION_STATE_KEYS,
  getPhonemeShape,
  type ChannelStore,
  type MotionState,
  type MotionStateKey,
  type TimelineEvent,
} from "@puppetflow/core";
import type { StateStore } from "@puppetflow/core";
import type { TimelineStore } from "@puppetflow/core";
import {
  evaluateStatefulGraphNode,
  type FrameContext,
  type StatefulRegistry,
  type StatefulStore,
} from "@puppetflow/stateful-core";
import {
  isMotionStateKey,
  type MotionGraphDocument,
  type MotionGraphNode,
} from "./types.js";

export type ExtensionGraphFunctionEvaluator = (
  functionName: string,
  args: Record<string, number>,
) => number;

export interface MotionGraphContext {
  state: StateStore;
  channels: ChannelStore;
  timeline: TimelineStore;
  timelineCurrentMs: number;
  activeTimelineEvents: TimelineEvent[];
  deltaTime: number;
  time: number;
  frame?: FrameContext;
  statefulStore?: StatefulStore;
  statefulRegistry?: StatefulRegistry;
  /** Extension registry scalar functions (e.g. heartbeat) for motionFunction nodes */
  evaluateExtensionFunction?: ExtensionGraphFunctionEvaluator;
}

function numericConfigFromNodeData(
  data: Record<string, unknown>,
  skipKeys: string[],
): Record<string, number> {
  const config: Record<string, number> = {};
  for (const [key, value] of Object.entries(data)) {
    if (skipKeys.includes(key)) {
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      config[key] = value;
    }
  }
  return config;
}

function topologicalOrder(document: MotionGraphDocument): MotionGraphNode[] {
  const nodeMap = new Map(document.nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const node of document.nodes) {
    incoming.set(node.id, 0);
    outgoing.set(node.id, []);
  }

  for (const edge of document.edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
      continue;
    }

    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }

  const queue = document.nodes
    .filter((node) => (incoming.get(node.id) ?? 0) === 0)
    .map((node) => node.id);
  const ordered: MotionGraphNode[] = [];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) {
      break;
    }

    const node = nodeMap.get(id);
    if (!node) {
      continue;
    }

    ordered.push(node);

    for (const targetId of outgoing.get(id) ?? []) {
      const nextCount = (incoming.get(targetId) ?? 1) - 1;
      incoming.set(targetId, nextCount);
      if (nextCount === 0) {
        queue.push(targetId);
      }
    }
  }

  if (ordered.length !== document.nodes.length) {
    throw new Error("Motion graph contains a cycle");
  }

  return ordered;
}

function getSingleInput(
  nodeId: string,
  values: Map<string, number>,
  document: MotionGraphDocument,
): number {
  const sourceId = document.edges.find((edge) => edge.target === nodeId)?.source;
  if (!sourceId) {
    return 0;
  }

  return values.get(sourceId) ?? 0;
}

function getBinaryInputs(
  nodeId: string,
  values: Map<string, number>,
  document: MotionGraphDocument,
): [number, number] {
  const sources = document.edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => edge.source);

  return [values.get(sources[0] ?? "") ?? 0, values.get(sources[1] ?? "") ?? 0];
}

function readChannelNumber(channels: ChannelStore, key: string): number {
  const raw = channels.get(key);
  return typeof raw === "number" ? clamp01(raw) : 0;
}

function readPhonemeFromTimeline(events: TimelineEvent[]): unknown {
  for (const event of events) {
    if (event.type !== "phoneme") {
      continue;
    }

    if (
      typeof event.value === "object" &&
      event.value !== null &&
      "phoneme" in event.value
    ) {
      return (event.value as { phoneme: unknown }).phoneme;
    }

    return event.value;
  }

  return "Rest";
}

function resolveGraphPhoneme(ctx: MotionGraphContext, source: string): unknown {
  if (source === "channel") {
    return ctx.channels.get("phoneme") ?? "Rest";
  }

  if (source === "timeline") {
    return readPhonemeFromTimeline(ctx.activeTimelineEvents);
  }

  const timelinePhoneme = readPhonemeFromTimeline(ctx.activeTimelineEvents);
  if (timelinePhoneme !== "Rest") {
    return timelinePhoneme;
  }

  return ctx.channels.get("phoneme") ?? "Rest";
}

function evaluateNode(
  node: MotionGraphNode,
  values: Map<string, number>,
  document: MotionGraphDocument,
  ctx: MotionGraphContext,
): number {
  switch (node.type) {
    case "stateInput": {
      const key = String(node.data.key ?? "");
      const raw = ctx.state.get(key);
      return typeof raw === "number" ? clamp01(raw) : 0;
    }
    case "channelInput": {
      const key = String(node.data.key ?? "volume");
      return readChannelNumber(ctx.channels, key);
    }
    case "timelineEventActive": {
      const type = String(node.data.eventType ?? "phoneme");
      const active = ctx.activeTimelineEvents.some((event) => event.type === type);
      return active ? 1 : 0;
    }
    case "currentPhonemeStrength": {
      for (const event of ctx.activeTimelineEvents) {
        if (event.type !== "phoneme") {
          continue;
        }

        if (
          typeof event.value === "object" &&
          event.value !== null &&
          "strength" in event.value
        ) {
          const strength = (event.value as { strength: unknown }).strength;
          return typeof strength === "number" ? clamp01(strength) : 1;
        }

        return 1;
      }

      return 0;
    }
    case "volumeToMouth": {
      const wired = document.edges.some((edge) => edge.target === node.id);
      const volume = wired
        ? getSingleInput(node.id, values, document)
        : readChannelNumber(ctx.channels, String(node.data.key ?? "volume"));
      const gain = Number(node.data.gain ?? 1);
      return clamp01(volume * gain);
    }
    case "phonemeToShape": {
      const source = String(node.data.source ?? "auto");
      const axis = String(node.data.axis ?? "mouthY");
      const phoneme = resolveGraphPhoneme(ctx, source);
      const shape = getPhonemeShape(phoneme);
      return axis === "mouthX" ? shape.mouthX : shape.mouthY;
    }
    case "constant":
      return clamp01(Number(node.data.value ?? 0));
    case "time":
      return clamp01(ctx.time % 1);
    case "multiply": {
      const input = getSingleInput(node.id, values, document);
      return clamp01(input * Number(node.data.gain ?? 1));
    }
    case "add": {
      const [left, right] = getBinaryInputs(node.id, values, document);
      return clamp01(left + right);
    }
    case "subtract": {
      const [left, right] = getBinaryInputs(node.id, values, document);
      return clamp01(left - right);
    }
    case "clamp": {
      const input = getSingleInput(node.id, values, document);
      const min = Number(node.data.min ?? 0);
      const max = Number(node.data.max ?? 1);
      return clamp01(Math.min(max, Math.max(min, input)));
    }
    case "sin": {
      const input = getSingleInput(node.id, values, document);
      return clamp01(0.5 + Math.sin(input * Math.PI * 2) * 0.5);
    }
    case "noise": {
      const amplitude = Number(node.data.amplitude ?? 0.02);
      return clamp01(0.5 + (Math.random() - 0.5) * amplitude * 2);
    }
    case "oscillator":
    case "smooth":
    case "spring":
    case "randomHold":
    case "blink":
    case "breath":
    case "wander":
    case "cooldown": {
      if (!ctx.statefulStore || !ctx.statefulRegistry || !ctx.frame) {
        return 0;
      }
      const input = getSingleInput(node.id, values, document);
      return evaluateStatefulGraphNode(
        node.type,
        node.data,
        node.id,
        input,
        ctx.frame,
        ctx.statefulStore,
        ctx.statefulRegistry,
      );
    }
    case "motionFunction": {
      const functionName = String(node.data.functionName ?? "");
      if (!functionName || !ctx.evaluateExtensionFunction) {
        return 0;
      }
      const args = numericConfigFromNodeData(node.data, ["functionName", "label"]);
      let value = clamp01(ctx.evaluateExtensionFunction(functionName, args));
      if (document.edges.some((edge) => edge.target === node.id)) {
        value = clamp01(value * getSingleInput(node.id, values, document));
      }
      return value;
    }
    default:
      return 0;
  }
}

export function executeMotionGraph(
  document: MotionGraphDocument,
  ctx: MotionGraphContext,
): Partial<MotionState> {
  if (document.nodes.length === 0) {
    return {};
  }

  const ordered = topologicalOrder(document);
  const values = new Map<string, number>();
  const outputBuckets = new Map<MotionStateKey, number[]>();

  for (const node of ordered) {
    if (node.type === "output") {
      const key = String(node.data.key ?? "");
      if (!isMotionStateKey(key)) {
        continue;
      }

      const value = clamp01(getSingleInput(node.id, values, document));
      const bucket = outputBuckets.get(key) ?? [];
      bucket.push(value);
      outputBuckets.set(key, bucket);
      values.set(node.id, value);
      continue;
    }

    values.set(node.id, evaluateNode(node, values, document, ctx));
  }

  const partials: Partial<MotionState>[] = [];
  for (const key of MOTION_STATE_KEYS) {
    const bucket = outputBuckets.get(key);
    if (!bucket || bucket.length === 0) {
      continue;
    }

    const average = bucket.reduce((sum, value) => sum + value, 0) / bucket.length;
    partials.push({ [key]: clamp01(average) } as Partial<MotionState>);
  }

  if (partials.length === 0) {
    return {};
  }

  return mergeMotionState(createEmptyMotionState(), partials);
}
