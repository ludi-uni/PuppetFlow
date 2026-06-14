import { compilePfScript } from "@puppetflow/pfscript-core";
import { describe, expect, it } from "vitest";
import {
  collectPluginLayerGuidance,
  formatLegacyPluginHint,
} from "./plugin-layer-warnings.js";

describe("plugin-layer-warnings", () => {
  it("hints when legacy gaze plugin is enabled", () => {
    const presetJson = JSON.stringify({
      version: 3,
      behaviorPfScript: "mouthY = volume",
      behavior: { type: "Block", statements: [] },
      behaviorPlugins: [{ id: "gaze", config: { wanderAmplitude: 0.05 } }],
      graph: { nodes: [], edges: [] },
    });

    expect(formatLegacyPluginHint(["gaze"])).toContain("gaze");
    expect(collectPluginLayerGuidance({ presetJson })).toContain("レガシー");
  });

  it("warns when PFScript wander overlaps gaze plugin on lookX", () => {
    const presetJson = JSON.stringify({
      version: 3,
      behaviorPlugins: [{ id: "gaze" }],
      graph: { nodes: [], edges: [] },
    });
    const pfScriptDraft = `
lookX = wander(id = "pf", speed = 0.3) * 0.1 + 0.5
`;

    const guidance = collectPluginLayerGuidance({
      presetJson,
      behaviorPluginsJson: JSON.stringify([{ id: "gaze" }]),
      graphJson: JSON.stringify({ nodes: [], edges: [] }),
      pfScriptDraft,
    });

    expect(guidance).toContain("lookX");
    expect(guidance).toContain("gaze");
  });

  it("does not warn for official blink + idle combination", () => {
    const presetJson = JSON.stringify({
      version: 3,
      behaviorPfScript: "mouthY = volume\neyeYaw = energy * 0.2",
      behaviorPlugins: [
        { id: "blink" },
        { id: "idle", config: { interestThreshold: 0.35 } },
      ],
      graph: { nodes: [], edges: [] },
    });

    const compiled = compilePfScript("mouthY = volume\neyeYaw = energy * 0.2");
    expect(compiled.statements.length).toBeGreaterThan(0);
    expect(
      collectPluginLayerGuidance({
        presetJson,
        pfScriptDraft: "mouthY = volume\neyeYaw = energy * 0.2",
      }),
    ).toBeNull();
  });
});
