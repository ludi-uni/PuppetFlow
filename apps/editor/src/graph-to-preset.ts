import { MOTION_STATE_KEYS, type MotionStateKey } from "@puppetflow/core";
import type { Edge, Node } from "@xyflow/react";

interface RuleConfig {
  input: string;
  output: MotionStateKey;
  gain: number;
}

const MOTION_STATE_KEY_SET = new Set<string>(MOTION_STATE_KEYS);

function isMotionStateKey(value: string): value is MotionStateKey {
  return MOTION_STATE_KEY_SET.has(value);
}

export interface GraphDocument {
  nodes: Node[];
  edges: Edge[];
}

export function graphToRules(graph: GraphDocument): RuleConfig[] {
  const rules: RuleConfig[] = [];
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));

  for (const edge of graph.edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) {
      continue;
    }

    if (source.type === "input" && target.type === "multiply") {
      const multiplyTargets = graph.edges
        .filter((item) => item.source === target.id)
        .map((item) => nodeMap.get(item.target))
        .filter((item): item is Node => Boolean(item));

      for (const outputNode of multiplyTargets) {
        if (outputNode.type !== "output") {
          continue;
        }

        const outputKey = String(outputNode.data.key ?? "mouthX");
        if (!isMotionStateKey(outputKey)) {
          continue;
        }

        rules.push({
          input: String(source.data.key ?? "interest"),
          output: outputKey,
          gain: Number(target.data.gain ?? 0.5),
        });
      }
    }
  }

  return rules;
}

function graphToMotionGraph(graph: GraphDocument) {
  return {
    nodes: graph.nodes.map((node) => {
      const id = node.id;
      if (node.type === "input") {
        return {
          id,
          type: "stateInput",
          data: { key: String(node.data.key ?? "interest") },
        };
      }
      if (node.type === "multiply") {
        return { id, type: "multiply", data: { gain: Number(node.data.gain ?? 0.5) } };
      }
      return {
        id,
        type: "output",
        data: { key: String(node.data.key ?? "mouthX") },
      };
    }),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  };
}

export function graphToPresetJson(graph: GraphDocument, name = "GraphPreset"): string {
  return JSON.stringify(
    {
      name,
      version: 2,
      behavior: { type: "Block", statements: [] },
      graph: graphToMotionGraph(graph),
      modifiers: [
        { id: "breath", config: { period: 4, amplitude: 0.05 } },
        { id: "noise", config: { amplitude: 0.015 } },
        { id: "smoothing", config: { factor: 0.18 } },
      ],
      modifierOrder: ["breath", "noise", "smoothing"],
    },
    null,
    2,
  );
}
