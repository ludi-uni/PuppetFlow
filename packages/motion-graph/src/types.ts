import { MOTION_STATE_KEYS, type MotionStateKey } from "@puppetflow/core";

export interface MotionGraphNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface MotionGraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface MotionGraphDocument {
  nodes: MotionGraphNode[];
  edges: MotionGraphEdge[];
}

const MAX_GRAPH_NODES = 500;
const MAX_GRAPH_EDGES = 1000;

function parseGraphNode(value: unknown, index: number): MotionGraphNode {
  if (typeof value !== "object" || value === null) {
    throw new Error(`graph.nodes[${index}] must be an object`);
  }

  const node = value as Partial<MotionGraphNode>;
  if (typeof node.id !== "string" || node.id.length === 0) {
    throw new Error(`graph.nodes[${index}] requires a non-empty id`);
  }
  if (typeof node.type !== "string" || node.type.length === 0) {
    throw new Error(`graph.nodes[${index}] requires a non-empty type`);
  }

  const data = node.data;
  if (
    data !== undefined &&
    (typeof data !== "object" || data === null || Array.isArray(data))
  ) {
    throw new Error(`graph.nodes[${index}].data must be an object when provided`);
  }

  return {
    id: node.id,
    type: node.type,
    data: (data as Record<string, unknown> | undefined) ?? {},
  };
}

function parseGraphEdge(value: unknown, index: number): MotionGraphEdge {
  if (typeof value !== "object" || value === null) {
    throw new Error(`graph.edges[${index}] must be an object`);
  }

  const edge = value as Partial<MotionGraphEdge>;
  if (typeof edge.id !== "string" || edge.id.length === 0) {
    throw new Error(`graph.edges[${index}] requires a non-empty id`);
  }
  if (typeof edge.source !== "string" || edge.source.length === 0) {
    throw new Error(`graph.edges[${index}] requires a non-empty source`);
  }
  if (typeof edge.target !== "string" || edge.target.length === 0) {
    throw new Error(`graph.edges[${index}] requires a non-empty target`);
  }

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
  };
}

export function parseMotionGraph(value: unknown): MotionGraphDocument {
  if (typeof value !== "object" || value === null) {
    throw new Error("graph must be an object");
  }

  const graph = value as Partial<MotionGraphDocument>;
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error("graph requires nodes and edges arrays");
  }

  if (graph.nodes.length > MAX_GRAPH_NODES) {
    throw new Error(`graph.nodes exceeds max count (${MAX_GRAPH_NODES})`);
  }
  if (graph.edges.length > MAX_GRAPH_EDGES) {
    throw new Error(`graph.edges exceeds max count (${MAX_GRAPH_EDGES})`);
  }

  return {
    nodes: graph.nodes.map((node, index) => parseGraphNode(node, index)),
    edges: graph.edges.map((edge, index) => parseGraphEdge(edge, index)),
  };
}

export function isMotionStateKey(value: string): value is MotionStateKey {
  return (MOTION_STATE_KEYS as readonly string[]).includes(value);
}
