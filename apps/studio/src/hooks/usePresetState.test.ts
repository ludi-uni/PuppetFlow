import { describe, expect, it } from "vitest";
import { assemblePresetFromParts, extractGraphJson } from "../utils/preset-parts";
import { PRESET_OPTIONS } from "./usePresetState";

describe("usePresetState", () => {
  it("lists all built-in preset names except Standard", () => {
    expect(PRESET_OPTIONS).toEqual([
      "Curious",
      "Happy",
      "Idle",
      "Thinking",
      "Sleepy",
      "Focused",
    ]);
  });

  it("assembles split editor parts into one preset JSON", () => {
    const base = JSON.stringify({
      name: "Curious",
      version: 3,
      behavior: { type: "Block", statements: [] },
      graph: { nodes: [], edges: [] },
      behaviorPlugins: [],
    });

    const graphJson = extractGraphJson(base);
    const behaviorPluginsJson = JSON.stringify(
      [{ id: "blink", config: { minInterval: 3 } }],
      null,
      2,
    );

    const assembled = assemblePresetFromParts(base, { graphJson, behaviorPluginsJson });
    const parsed = JSON.parse(assembled) as {
      graph: { nodes: unknown[] };
      behaviorPlugins: Array<{ id: string }>;
    };

    expect(parsed.graph.nodes).toBeDefined();
    expect(parsed.behaviorPlugins[0]?.id).toBe("blink");
  });
});
