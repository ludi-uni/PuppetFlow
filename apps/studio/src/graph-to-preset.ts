import { MOTION_STATE_KEYS, type MotionStateKey } from "@puppetflow/core";
import type { RuleConfig } from "@puppetflow/plugin-rule";
import type { Edge, Node } from "@xyflow/react";

interface GraphDocument {
  nodes: Node[];
  edges: Edge[];
}

const MOTION_STATE_KEY_SET = new Set<string>(MOTION_STATE_KEYS);

function isMotionStateKey(value: string): value is MotionStateKey {
  return MOTION_STATE_KEY_SET.has(value);
}

function graphToMotionGraph(document: GraphDocument) {
  return {
    nodes: document.nodes.map((node) => ({
      id: node.id,
      type: mapNodeType(String(node.type ?? "multiply")),
      data: mapNodeData(node),
    })),
    edges: document.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  };
}

function mapNodeType(type: string): string {
  switch (type) {
    case "input":
      return "stateInput";
    case "channelInput":
      return "channelInput";
    case "volumeToMouth":
      return "volumeToMouth";
    case "phonemeToShape":
      return "phonemeToShape";
    case "multiply":
      return "multiply";
    case "output":
      return "output";
    default:
      return type;
  }
}

function mapNodeData(node: Node): Record<string, unknown> {
  if (node.type === "input") {
    return { key: String(node.data.key ?? "interest") };
  }

  if (node.type === "channelInput") {
    return { key: String(node.data.key ?? "volume") };
  }

  if (node.type === "volumeToMouth") {
    return {
      key: String(node.data.key ?? "volume"),
      gain: Number(node.data.gain ?? 1),
    };
  }

  if (node.type === "phonemeToShape") {
    return {
      axis: String(node.data.axis ?? "mouthY"),
      source: String(node.data.source ?? "auto"),
    };
  }

  if (node.type === "multiply") {
    return { gain: Number(node.data.gain ?? 0.5) };
  }

  if (node.type === "output") {
    const key = String(node.data.key ?? "mouthX");
    return { key: isMotionStateKey(key) ? key : "mouthX" };
  }

  return { ...node.data };
}

export function graphToRules(graph: GraphDocument): RuleConfig[] {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const rules: RuleConfig[] = [];

  for (const node of graph.nodes) {
    if (node.type !== "output") {
      continue;
    }

    const outputKey = String(node.data.key ?? "");
    if (!isMotionStateKey(outputKey)) {
      continue;
    }

    const outputEdge = graph.edges.find((edge) => edge.target === node.id);
    if (!outputEdge) {
      continue;
    }

    const multiplyNode = nodeMap.get(outputEdge.source);
    if (!multiplyNode || multiplyNode.type !== "multiply") {
      continue;
    }

    const multiplyEdge = graph.edges.find((edge) => edge.target === multiplyNode.id);
    if (!multiplyEdge) {
      continue;
    }

    const inputNode = nodeMap.get(multiplyEdge.source);
    if (!inputNode || inputNode.type !== "input") {
      continue;
    }

    rules.push({
      input: String(inputNode.data.key ?? "interest"),
      output: outputKey,
      gain: Number(multiplyNode.data.gain ?? 0.5),
    });
  }

  return rules;
}

/**
 * Merges the visual graph into an existing preset, preserving behavior / plugins / modifiers.
 * Graph editor is authoritative for numeric mapping: `graph` is updated and duplicate `rules`
 * are cleared to avoid double-processing alongside motion-graph.
 */
export function mergeGraphIntoPreset(presetJson: string, graph: GraphDocument): string {
  const parsed = JSON.parse(presetJson) as Record<string, unknown>;

  parsed.version = 2;
  parsed.graph = graphToMotionGraph(graph);

  if (graph.nodes.length > 0) {
    parsed.rules = [];
  }

  if (typeof parsed.behavior !== "object" || parsed.behavior === null) {
    parsed.behavior = { type: "Block", statements: [] };
  }

  return JSON.stringify(parsed, null, 2);
}

/** @deprecated Use mergeGraphIntoPreset to preserve plugins and other preset fields. */
export function graphToPresetJson(graph: GraphDocument, name = "GraphPreset"): string {
  return mergeGraphIntoPreset(
    JSON.stringify({
      name,
      version: 2,
      behavior: { type: "Block", statements: [] },
      graph: { nodes: [], edges: [] },
      modifiers: [
        { id: "breath", config: { period: 4, amplitude: 0.05 } },
        { id: "noise", config: { amplitude: 0.015 } },
        { id: "smoothing", config: { factor: 0.18 } },
      ],
      modifierOrder: ["breath", "noise", "smoothing"],
    }),
    graph,
  );
}
