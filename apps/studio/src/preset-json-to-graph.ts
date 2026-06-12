import { MOTION_STATE_KEYS } from "@puppetflow/core";
import type { RuleConfig } from "@puppetflow/plugin-rule";
import type { Edge, Node } from "@xyflow/react";

interface PresetV2Document {
  graph?: {
    nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>;
    edges: Array<{ id: string; source: string; target: string }>;
  };
  rules?: RuleConfig[];
}

function mapRuntimeTypeToEditor(type: string): string {
  switch (type) {
    case "stateInput":
      return "input";
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

function runtimeGraphToEditor(graph: NonNullable<PresetV2Document["graph"]>): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = graph.nodes.map((node, index) => ({
    id: node.id,
    type: mapRuntimeTypeToEditor(node.type),
    position: { x: (index % 3) * 220, y: Math.floor(index / 3) * 100 },
    data: {
      label: String(node.data.key ?? node.data.axis ?? node.type),
      key: node.data.key,
      gain: node.data.gain,
      axis: node.data.axis,
      source: node.data.source,
    },
  }));

  const edges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));

  return { nodes, edges };
}

function rulesToEditorGraph(rules: RuleConfig[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  rules.forEach((rule, index) => {
    const inputId = `rule-in-${index}`;
    const multiplyId = `rule-mul-${index}`;
    const outputId = `rule-out-${index}`;
    const y = index * 100;

    nodes.push({
      id: inputId,
      type: "input",
      position: { x: 0, y },
      data: { label: rule.input, key: rule.input },
    });
    nodes.push({
      id: multiplyId,
      type: "multiply",
      position: { x: 220, y },
      data: { label: "Multiply", gain: rule.gain },
    });
    nodes.push({
      id: outputId,
      type: "output",
      position: { x: 460, y },
      data: { label: rule.output, key: rule.output },
    });
    edges.push({ id: `rule-e-${index}-1`, source: inputId, target: multiplyId });
    edges.push({ id: `rule-e-${index}-2`, source: multiplyId, target: outputId });
  });

  return { nodes, edges };
}

export function presetJsonToGraph(json: string): { nodes: Node[]; edges: Edge[] } {
  let parsed: PresetV2Document;
  try {
    parsed = JSON.parse(json) as PresetV2Document;
  } catch {
    return { nodes: [], edges: [] };
  }

  if (parsed.graph && parsed.graph.nodes.length > 0) {
    return runtimeGraphToEditor(parsed.graph);
  }

  if (parsed.rules && parsed.rules.length > 0) {
    return rulesToEditorGraph(parsed.rules);
  }

  return { nodes: [], edges: [] };
}

export function getStateKeyOptions(): string[] {
  return ["interest", "energy", "stress"];
}

export function getChannelKeyOptions(): string[] {
  return ["volume", "phoneme", "emotion", "gazeTarget", "joy", "sadness", "anger"];
}

export function getMotionKeyOptions(): string[] {
  return [...MOTION_STATE_KEYS];
}
