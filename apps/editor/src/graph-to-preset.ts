import type { Edge, Node } from "@xyflow/react";
import {
  graphDocumentToPresetJson,
  type EditorGraphDocument,
} from "@puppetflow/motion-graph";

export interface GraphDocument {
  nodes: Node[];
  edges: Edge[];
}

function toEditorGraph(graph: GraphDocument): EditorGraphDocument {
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data as Record<string, unknown>,
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  };
}

export function graphToPresetJson(graph: GraphDocument, name = "GraphPreset"): string {
  return graphDocumentToPresetJson(toEditorGraph(graph), name);
}
