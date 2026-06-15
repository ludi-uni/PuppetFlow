import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  collectPresetMotionKeys,
  detectPresetMotionOverlaps,
} from "./collect-preset-motion-keys.js";
import { loadPreset } from "./load-preset.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("examples/pfscript presets", () => {
  it("loads pfscript-demo.pfpreset with Standard model", () => {
    const json = readFileSync(
      join(repoRoot, "examples/pfscript/pfscript-demo.pfpreset"),
      "utf8",
    );
    const loaded = loadPreset(json);

    expect(loaded.behaviorPfScript).toContain("mouthY");
    expect(loaded.behavior.statements.length).toBeGreaterThan(0);
    expect(loaded.behaviorPlugins?.map((plugin) => plugin.id)).toEqual([
      "blink",
      "idle",
    ]);
    expect(loaded.extensions?.packs?.[0]?.id).toBe("thinking");

    const motionKeys = collectPresetMotionKeys({
      behavior: loaded.behavior,
      graph: loaded.graph,
      behaviorPlugins: loaded.behaviorPlugins,
    });
    expect(motionKeys.find((entry) => entry.motionKey === "mouthX")?.sources).toEqual([
      "graph",
    ]);

    const overlaps = detectPresetMotionOverlaps({
      behavior: loaded.behavior,
      graph: loaded.graph,
      behaviorPlugins: loaded.behaviorPlugins,
    });
    expect(overlaps).toEqual([]);
  });
});
