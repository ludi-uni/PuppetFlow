import { describe, expect, it } from "vitest";
import { parseMotionGraph } from "./types.js";

describe("parseMotionGraph", () => {
  it("accepts valid graph documents", () => {
    const graph = parseMotionGraph({
      nodes: [{ id: "in", type: "stateInput", data: { key: "interest" } }],
      edges: [],
    });

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]?.data).toEqual({ key: "interest" });
  });

  it("rejects nodes without ids", () => {
    expect(() =>
      parseMotionGraph({
        nodes: [{ type: "constant", data: { value: 1 } }],
        edges: [],
      }),
    ).toThrow(/non-empty id/i);
  });

  it("rejects edges without source or target", () => {
    expect(() =>
      parseMotionGraph({
        nodes: [{ id: "a", type: "constant", data: {} }],
        edges: [{ id: "e1", source: "a", target: "" }],
      }),
    ).toThrow(/non-empty target/i);
  });
});
