import { describe, expect, it } from "vitest";
import { loadPreset } from "./load-preset.js";

describe("loadPreset", () => {
  it("loads v3 behavior, graph, and behaviorPlugins", () => {
    const loaded = loadPreset(
      JSON.stringify({
        name: "Curious",
        version: 3,
        behavior: { type: "Block", statements: [] },
        graph: { nodes: [], edges: [] },
        behaviorPlugins: [{ id: "gaze", config: { wanderAmplitude: 0.04 } }],
      }),
    );

    expect(loaded.name).toBe("Curious");
    expect(loaded.behavior.type).toBe("Block");
    expect(loaded.graph.nodes).toEqual([]);
    expect(loaded.plugins).toHaveLength(1);
    expect(loaded.plugins[0]?.id).toBe("gaze");
    expect(loaded.behaviorPlugins).toHaveLength(1);
  });

  it("rejects v2 presets", () => {
    expect(() =>
      loadPreset(
        JSON.stringify({
          name: "Legacy",
          version: 2,
          behavior: { type: "Block", statements: [] },
          graph: { nodes: [], edges: [] },
        }),
      ),
    ).toThrow(/version/i);
  });

  it("rejects deprecated rules field", () => {
    expect(() =>
      loadPreset(
        JSON.stringify({
          name: "RulesPreset",
          version: 3,
          behavior: { type: "Block", statements: [] },
          graph: { nodes: [], edges: [] },
          rules: [{ input: "interest", output: "mouthX", gain: 0.5 }],
        }),
      ),
    ).toThrow(/rules/i);
  });

  it("rejects deprecated modifiers field", () => {
    expect(() =>
      loadPreset(
        JSON.stringify({
          name: "ModifierPreset",
          version: 3,
          behavior: { type: "Block", statements: [] },
          graph: { nodes: [], edges: [] },
          modifiers: [{ id: "breath", config: { period: 4 } }],
        }),
      ),
    ).toThrow(/modifiers/i);
  });

  it("rejects Builtin statements in behavior", () => {
    expect(() =>
      loadPreset(
        JSON.stringify({
          name: "BuiltinPreset",
          version: 3,
          behavior: {
            type: "Block",
            statements: [{ type: "Builtin", id: "gaze" }],
          },
          graph: { nodes: [], edges: [] },
        }),
      ),
    ).toThrow(/Builtin/i);
  });

  it("rejects oversized preset JSON", () => {
    const json = JSON.stringify({
      name: "Huge",
      version: 3,
      behavior: { type: "Block", statements: [] },
      graph: { nodes: [], edges: [] },
      padding: "x".repeat(2_000_000),
    });

    expect(() => loadPreset(json)).toThrow(/exceeds max size/i);
  });

  it("loads extensions.packs and parameterDefaults", () => {
    const loaded = loadPreset(
      JSON.stringify({
        name: "Thinking",
        version: 3,
        behavior: { type: "Block", statements: [] },
        graph: { nodes: [], edges: [] },
        extensions: {
          packs: [{ id: "thinking", config: { intensity: 0.65 } }],
          parameterDefaults: { tailWag: 0.5 },
        },
      }),
    );

    expect(loaded.extensions?.packs).toEqual([
      { id: "thinking", config: { intensity: 0.65 } },
    ]);
    expect(loaded.extensions?.parameterDefaults).toEqual({ tailWag: 0.5 });
  });
});
