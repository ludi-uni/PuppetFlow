import { compilePfScript } from "@puppetflow/pfscript-core";
import { describe, expect, it } from "vitest";
import { detectPresetMotionOverlaps } from "./collect-preset-motion-keys.js";
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

  it("loads behaviorPfScript and compiles behavior", () => {
    const loaded = loadPreset(
      JSON.stringify({
        name: "PfScriptPreset",
        version: 3,
        behaviorPfScript: "smile = interest * 0.5",
        graph: { nodes: [], edges: [] },
      }),
    );

    expect(loaded.behaviorPfScript).toContain("smile");
    expect(loaded.behavior.statements[0]).toMatchObject({
      type: "ExprAssign",
      target: "mouthX",
    });
  });

  it("prefers behaviorPfScript over stale behavior cache on load", () => {
    const loaded = loadPreset(
      JSON.stringify({
        name: "StaleCache",
        version: 3,
        behaviorPfScript: "smile = 0.9",
        behavior: {
          type: "Block",
          statements: [{ type: "Assign", key: "mouthX", op: "set", value: 0.1 }],
        },
        graph: { nodes: [], edges: [] },
      }),
    );

    expect(loaded.behavior.statements[0]).toMatchObject({
      type: "ExprAssign",
      value: { type: "Number", value: 0.9 },
    });
  });

  it("rejects presets without behavior or behaviorPfScript", () => {
    expect(() =>
      loadPreset(
        JSON.stringify({
          name: "EmptyBehavior",
          version: 3,
          graph: { nodes: [], edges: [] },
        }),
      ),
    ).toThrow(/requires behavior or behaviorPfScript/i);
  });

  it("reports PFScript syntax errors with location", () => {
    expect(() =>
      loadPreset(
        JSON.stringify({
          name: "BrokenScript",
          version: 3,
          behaviorPfScript: "for i = 1, 10 do end",
          graph: { nodes: [], edges: [] },
        }),
      ),
    ).toThrow(/\(1:/);
  });

  it("migrates legacy motion keys in behavior and graph", () => {
    const loaded = loadPreset(
      JSON.stringify({
        name: "LegacyKeys",
        version: 3,
        behavior: {
          type: "Block",
          statements: [{ type: "Assign", key: "faceRoll", op: "set", value: 0.6 }],
        },
        graph: {
          nodes: [{ id: "out", type: "output", data: { key: "bodyPitch" } }],
          edges: [],
        },
      }),
    );

    expect(loaded.behavior.statements[0]).toMatchObject({
      type: "Assign",
      key: "headTilt",
    });
    expect(loaded.graph.nodes[0]?.data.key).toBe("bodyLean");
    expect(loaded.warnings.some((w) => w.includes("faceRoll"))).toBe(true);
    expect(loaded.warnings.some((w) => w.includes("bodyPitch"))).toBe(true);
  });

  it("compiles legacy PFScript motion names to current keys", () => {
    const loaded = loadPreset(
      JSON.stringify({
        name: "LegacyPfScript",
        version: 3,
        behaviorPfScript: "faceRoll = 0.6",
        graph: { nodes: [], edges: [] },
      }),
    );

    expect(loaded.behavior.statements[0]).toMatchObject({
      type: "ExprAssign",
      target: "headTilt",
    });
  });
});

describe("detectPresetMotionOverlaps", () => {
  it("warns when plugin and graph both output headTilt", () => {
    const warnings = detectPresetMotionOverlaps({
      behavior: { type: "Block", statements: [] },
      behaviorPlugins: [{ id: "attention" }],
      graph: {
        nodes: [{ id: "out", type: "output", data: { key: "headTilt" } }],
        edges: [],
      },
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.motionKey).toBe("headTilt");
    expect(warnings[0]?.sources).toContain("graph");
    expect(warnings[0]?.sources).toContain("plugin:attention");
  });

  it("warns when PFScript ExprAssign and graph both output mouthX", () => {
    const behavior = compilePfScript("mouthX = clamp(interest, 0, 1)");
    const warnings = detectPresetMotionOverlaps({
      behavior,
      behaviorPlugins: [],
      graph: {
        nodes: [{ id: "out", type: "output", data: { key: "mouthX" } }],
        edges: [],
      },
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.motionKey).toBe("mouthX");
    expect(warnings[0]?.sources).toEqual(["graph", "behavior"]);
  });

  it("warns when gaze and idle plugins both output lookX", () => {
    const warnings = detectPresetMotionOverlaps({
      behavior: { type: "Block", statements: [] },
      behaviorPlugins: [{ id: "gaze" }, { id: "idle" }],
      graph: { nodes: [], edges: [] },
    });

    expect(warnings).toHaveLength(2);
    expect(warnings.map((warning) => warning.motionKey).sort()).toEqual([
      "lookX",
      "lookY",
    ]);
  });
});
