import { describe, expect, it } from "vitest";
import {
  deserializeGraphToEditor,
  mergeGraphIntoPresetJson,
  serializeEditorGraph,
} from "./graph-editor-bridge.js";

describe("graph-editor-bridge", () => {
  it("round-trips motionPack nodes with position", () => {
    const graph = {
      nodes: [
        {
          id: "pack-1",
          type: "motionPack",
          position: { x: 100, y: 200 },
          data: { label: "Thinking", packId: "thinking", intensity: 0.65 },
        },
      ],
      edges: [],
    };

    const serialized = serializeEditorGraph(graph);
    expect(serialized.nodes[0]).toMatchObject({
      type: "motionPack",
      data: { packId: "thinking", intensity: 0.65 },
      position: { x: 100, y: 200 },
    });

    const restored = deserializeGraphToEditor(serialized);
    expect(restored.nodes[0]?.position).toEqual({ x: 100, y: 200 });
    expect(restored.nodes[0]?.data.packId).toBe("thinking");
  });

  it("merges graph into preset while preserving extensions", () => {
    const presetJson = JSON.stringify({
      name: "Test",
      version: 3,
      behavior: { type: "Block", statements: [] },
      graph: { nodes: [], edges: [] },
      extensions: { packs: [{ id: "thinking", config: { intensity: 0.8 } }] },
    });

    const merged = mergeGraphIntoPresetJson(presetJson, {
      nodes: [
        {
          id: "out",
          type: "output",
          position: { x: 0, y: 0 },
          data: { key: "mouthX", label: "mouthX" },
        },
      ],
      edges: [],
    });

    const parsed = JSON.parse(merged) as {
      extensions: { packs: Array<{ id: string }> };
      graph: { nodes: Array<{ type: string }> };
    };
    expect(parsed.extensions.packs[0]?.id).toBe("thinking");
    expect(parsed.graph.nodes[0]?.type).toBe("output");
  });
});
