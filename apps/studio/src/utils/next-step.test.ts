import { describe, expect, it } from "vitest";
import { DEFAULT_MAPPER_CONFIG } from "../mapper-config";
import { resolveNextStep } from "./next-step";

const graphWithOutput = JSON.stringify({
  nodes: [
    { id: "in", type: "stateInput", data: { key: "interest" } },
    { id: "mul", type: "multiply", data: { gain: 0.5 } },
    { id: "out", type: "output", data: { key: "mouthX" } },
  ],
  edges: [
    { id: "e1", source: "in", target: "mul" },
    { id: "e2", source: "mul", target: "out" },
  ],
});

describe("resolveNextStep", () => {
  it("guides to mapper when OSC target is disabled", () => {
    const guide = resolveNextStep({
      mapperConfig: {
        ...DEFAULT_MAPPER_CONFIG,
        vmc: { ...DEFAULT_MAPPER_CONFIG.vmc, enabled: false },
      },
      graphJson: graphWithOutput,
      pluginsHaveChanges: false,
    });

    expect(guide.tab).toBe("mapper");
    expect(guide.status).toBe("action");
  });

  it("guides to mapping when graph has no outputs", () => {
    const guide = resolveNextStep({
      mapperConfig: DEFAULT_MAPPER_CONFIG,
      graphJson: JSON.stringify({ nodes: [], edges: [] }),
      pluginsHaveChanges: false,
    });

    expect(guide.tab).toBe("mapping");
    expect(guide.status).toBe("action");
  });

  it("guides to plugins when optional plugin toggles are dirty", () => {
    const guide = resolveNextStep({
      mapperConfig: DEFAULT_MAPPER_CONFIG,
      graphJson: graphWithOutput,
      pluginsHaveChanges: true,
    });

    expect(guide.tab).toBe("plugins");
    expect(guide.status).toBe("action");
  });
});
