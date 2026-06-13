import { MOTION_STATE_KEYS } from "@puppetflow/core";
import { deserializeGraphToEditor } from "@puppetflow/motion-graph";
import type { Edge, Node } from "@xyflow/react";

interface PresetGraphDocument {
  graph?: {
    nodes: Array<{
      id: string;
      type: string;
      data: Record<string, unknown>;
      position?: { x: number; y: number };
    }>;
    edges: Array<{ id: string; source: string; target: string }>;
  };
}

export function presetJsonToGraph(json: string): { nodes: Node[]; edges: Edge[] } {
  let parsed: PresetGraphDocument;
  try {
    parsed = JSON.parse(json) as PresetGraphDocument;
  } catch {
    return { nodes: [], edges: [] };
  }

  if (!parsed.graph || parsed.graph.nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const editor = deserializeGraphToEditor(parsed.graph);
  return {
    nodes: editor.nodes.map((node) => ({
      id: node.id,
      type: node.type ?? "multiply",
      position: node.position ?? { x: 0, y: 0 },
      data: node.data,
    })),
    edges: editor.edges,
  };
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
