import { describe, expect, it } from "vitest";
import { mergePfScriptIntoPreset, compilePfScriptSource } from "./pfscript-preset.js";
import { assemblePresetFromParts, extractGraphJson } from "./preset-parts.js";

describe("assemblePresetFromParts", () => {
  it("merges split graph and behaviorPlugins into base preset", () => {
    const base = JSON.stringify({
      name: "Test",
      version: 3,
      behavior: { type: "Block", statements: [] },
      graph: { nodes: [], edges: [] },
      behaviorPlugins: [],
    });

    const graphJson = JSON.stringify(
      {
        nodes: [{ id: "n1", type: "multiply", data: { gain: 1 } }],
        edges: [],
      },
      null,
      2,
    );
    const behaviorPluginsJson = JSON.stringify(
      [{ id: "gaze", config: { wanderAmplitude: 0.05 } }],
      null,
      2,
    );

    const assembled = assemblePresetFromParts(base, { graphJson, behaviorPluginsJson });
    const parsed = JSON.parse(assembled) as {
      graph: { nodes: unknown[] };
      behaviorPlugins: unknown[];
    };

    expect(parsed.graph.nodes).toHaveLength(1);
    expect(parsed.behaviorPlugins).toHaveLength(1);
  });

  it("keeps graph and behaviorPlugins when PFScript is applied to assembled preset", () => {
    const base = JSON.stringify({
      name: "Curious",
      version: 3,
      behavior: { type: "Block", statements: [] },
      behaviorPlugins: [{ id: "gaze", config: { wanderAmplitude: 0.04 } }],
      graph: {
        nodes: [{ id: "n1", type: "multiply", data: { gain: 0.5 } }],
        edges: [],
      },
    });
    const assembled = assemblePresetFromParts(base, {
      graphJson: extractGraphJson(base),
      behaviorPluginsJson: JSON.stringify([
        { id: "gaze", config: { wanderAmplitude: 0.04 } },
      ]),
    });

    const pfScript = "smile = interest * 0.4";
    const merged = mergePfScriptIntoPreset(
      assembled,
      pfScript,
      compilePfScriptSource(pfScript).behavior,
    );
    const parsed = JSON.parse(merged) as {
      graph: { nodes: unknown[] };
      behaviorPlugins: unknown[];
      behaviorPfScript?: string;
    };

    expect(parsed.behaviorPfScript).toContain("smile");
    expect(parsed.graph.nodes.length).toBeGreaterThan(0);
    expect(parsed.behaviorPlugins).toHaveLength(1);
  });
});
