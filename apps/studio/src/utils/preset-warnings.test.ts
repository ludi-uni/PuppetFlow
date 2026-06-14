import { compilePfScript } from "@puppetflow/pfscript-core";
import { describe, expect, it } from "vitest";
import {
  collectLoadPresetWarnings,
  detectPresetStageOverlaps,
  formatLoadOverlapWarnings,
  formatOverlapWarnings,
} from "./preset-warnings.js";

describe("preset-warnings", () => {
  it("detects graph + behavior mouthX overlap", () => {
    const overlaps = detectPresetStageOverlaps({
      behavior: compilePfScript("mouthX = interest * 0.4"),
      graphJson: JSON.stringify({
        nodes: [
          { id: "in", type: "stateInput", data: { key: "interest" } },
          { id: "out", type: "output", data: { key: "mouthX" } },
        ],
        edges: [{ id: "e1", source: "in", target: "out" }],
      }),
      behaviorPluginsJson: "[]",
    });

    expect(overlaps).toHaveLength(1);
    expect(formatOverlapWarnings(overlaps)).toContain("mouthX");
  });

  it("does not warn for blink + PFScript eyeYaw layering", () => {
    const overlaps = detectPresetStageOverlaps({
      behavior: compilePfScript("eyeYaw = energy * 0.3"),
      graphJson: '{"nodes":[],"edges":[]}',
      behaviorPluginsJson: JSON.stringify([{ id: "blink" }]),
    });

    expect(overlaps).toEqual([]);
  });

  it("formats loadPreset overlap warnings for UI", () => {
    const json = JSON.stringify({
      name: "OverlapTest",
      version: 3,
      behaviorPfScript: "mouthX = interest",
      behavior: { type: "Block", statements: [] },
      graph: {
        nodes: [
          { id: "in", type: "stateInput", data: { key: "interest" } },
          { id: "out", type: "output", data: { key: "mouthX" } },
        ],
        edges: [{ id: "e1", source: "in", target: "out" }],
      },
    });

    const warnings = collectLoadPresetWarnings(json);
    expect(formatLoadOverlapWarnings(warnings)).toContain("mouthX");
  });
});
