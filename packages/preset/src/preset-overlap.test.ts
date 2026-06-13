import { describe, expect, it } from "vitest";
import { detectPresetMotionOverlaps } from "./preset-overlap.js";

describe("detectPresetMotionOverlaps", () => {
  it("warns when plugin and graph both output headTilt", () => {
    const warnings = detectPresetMotionOverlaps({
      behavior: { type: "Block", statements: [] },
      behaviorPlugins: [{ id: "attention" }],
      graph: {
        nodes: [
          { id: "out", type: "output", data: { key: "headTilt" } },
        ],
        edges: [],
      },
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.motionKey).toBe("headTilt");
    expect(warnings[0]?.sources).toContain("graph");
    expect(warnings[0]?.sources).toContain("plugin:attention");
  });

  it("does not warn when multiple plugins share lookX", () => {
    const warnings = detectPresetMotionOverlaps({
      behavior: { type: "Block", statements: [] },
      behaviorPlugins: [{ id: "gaze" }, { id: "idle" }],
      graph: { nodes: [], edges: [] },
    });

    expect(warnings).toEqual([]);
  });
});
