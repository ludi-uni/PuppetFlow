import { describe, expect, it } from "vitest";
import { loadPreset } from "./load-preset.js";

describe("loadPreset", () => {
  it("loads v2 behavior, graph, and modifiers", () => {
    const loaded = loadPreset(
      JSON.stringify({
        name: "Curious",
        version: 2,
        behavior: { type: "Block", statements: [] },
        graph: { nodes: [], edges: [] },
        modifiers: [
          { id: "breath", config: { period: 4 } },
          { id: "noise", config: { amplitude: 0.01 } },
          { id: "smoothing", config: { factor: 0.2 } },
        ],
      }),
    );

    expect(loaded.name).toBe("Curious");
    expect(loaded.modifiers).toHaveLength(3);
    expect(loaded.behavior.type).toBe("Block");
    expect(loaded.graph.nodes).toEqual([]);
    expect(loaded.modifierOrder).toEqual(["breath", "noise", "smoothing"]);
  });

  it("loads optional rules and behaviorPlugins", () => {
    const loaded = loadPreset(
      JSON.stringify({
        name: "PluginPreset",
        version: 2,
        behavior: { type: "Block", statements: [] },
        graph: { nodes: [], edges: [] },
        rules: [{ input: "interest", output: "mouthX", gain: 0.5 }],
        behaviorPlugins: [{ id: "gaze", config: { wanderAmplitude: 0.04 } }],
      }),
    );

    expect(loaded.plugins).toHaveLength(2);
    expect(loaded.plugins.map((plugin) => plugin.id)).toEqual(["rule", "gaze"]);
    expect(loaded.rules).toHaveLength(1);
    expect(loaded.behaviorPlugins).toHaveLength(1);
  });

  it("rejects v1 presets", () => {
    expect(() =>
      loadPreset(
        JSON.stringify({
          name: "Legacy",
          version: 1,
          rules: [{ input: "interest", output: "smile", gain: 0.5 }],
        }),
      ),
    ).toThrow(/version/i);
  });
});
