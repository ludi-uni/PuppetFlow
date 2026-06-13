import { MOTION_STATE_KEYS, type MotionStateKey } from "@puppetflow/core";
import { LIPSYNC_GRAPH_TEMPLATE } from "./lipsync-template";

export interface SimpleMappingRow {
  id: string;
  input: string;
  output: MotionStateKey;
  gain: number;
}

export const SIMPLE_INPUT_OPTIONS = [
  { value: "interest", label: "興味・関心" },
  { value: "energy", label: "元気" },
  { value: "stress", label: "ストレス" },
] as const;

export const SIMPLE_OUTPUT_OPTIONS: Array<{ value: MotionStateKey; label: string }> = [
  { value: "mouthX", label: "口（横・笑顔）" },
  { value: "mouthY", label: "口（開き）" },
  { value: "facePitch", label: "顔の上下" },
  { value: "headTilt", label: "頭の傾き" },
  { value: "bodyLean", label: "体の傾き" },
  { value: "lookX", label: "視線（横）" },
  { value: "lookY", label: "視線（縦）" },
];

const LIPSYNC_NODE_IDS = new Set(LIPSYNC_GRAPH_TEMPLATE.nodes.map((node) => node.id));
const MOTION_STATE_KEY_SET = new Set<string>(MOTION_STATE_KEYS);

interface GraphDocument {
  nodes: Array<{ id: string; type: string; data?: Record<string, unknown> }>;
  edges: Array<{ id: string; source: string; target: string }>;
}

function parseGraphDocument(graphJson: string): GraphDocument {
  const parsed = JSON.parse(graphJson) as GraphDocument;
  return {
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
    edges: Array.isArray(parsed.edges) ? parsed.edges : [],
  };
}

function isMotionStateKey(value: string): value is MotionStateKey {
  return MOTION_STATE_KEY_SET.has(value);
}

export function parseSimpleMappingsFromGraph(graphJson: string): SimpleMappingRow[] {
  try {
    const graph = parseGraphDocument(graphJson);
    const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
    const rows: SimpleMappingRow[] = [];
    let index = 0;

    for (const node of graph.nodes) {
      if (node.type !== "output" || LIPSYNC_NODE_IDS.has(node.id)) {
        continue;
      }

      const outputKey = String(node.data?.key ?? "");
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
      if (!inputNode || inputNode.type !== "stateInput") {
        continue;
      }

      rows.push({
        id: `mapping-${index}`,
        input: String(inputNode.data?.key ?? "interest"),
        output: outputKey,
        gain: Number(multiplyNode.data?.gain ?? 0.5),
      });
      index += 1;
    }

    return rows;
  } catch {
    return [];
  }
}

/** @deprecated Use parseSimpleMappingsFromGraph */
export function parseSimpleMappings(graphJson: string): SimpleMappingRow[] {
  return parseSimpleMappingsFromGraph(graphJson);
}

export function applySimpleMappingsToGraph(
  graphJson: string,
  rows: SimpleMappingRow[],
): string {
  const graph = parseGraphDocument(graphJson);
  const lipsyncNodes = graph.nodes.filter((node) => LIPSYNC_NODE_IDS.has(node.id));
  const lipsyncEdges = graph.edges.filter(
    (edge) => LIPSYNC_NODE_IDS.has(edge.source) || LIPSYNC_NODE_IDS.has(edge.target),
  );

  const nodes = [...lipsyncNodes];
  const edges = [...lipsyncEdges];
  let edgeCounter = 1;

  for (const [index, row] of rows.entries()) {
    const inId = `map-in-${index}-${row.output}`;
    const mulId = `map-mul-${index}-${row.output}`;
    const outId = `map-out-${index}-${row.output}`;

    nodes.push(
      { id: inId, type: "stateInput", data: { key: row.input } },
      { id: mulId, type: "multiply", data: { gain: row.gain } },
      { id: outId, type: "output", data: { key: row.output } },
    );
    edges.push(
      { id: `map-e-${edgeCounter++}`, source: inId, target: mulId },
      { id: `map-e-${edgeCounter++}`, source: mulId, target: outId },
    );
  }

  return JSON.stringify({ nodes, edges }, null, 2);
}

export function createDefaultMappingRow(): SimpleMappingRow {
  return {
    id: `mapping-${Date.now()}`,
    input: "interest",
    output: "mouthX",
    gain: 0.5,
  };
}
