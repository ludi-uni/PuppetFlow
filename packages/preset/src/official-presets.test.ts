import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPreset } from "./load-preset.js";

const PRESETS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../behavior-packs/presets");

const OFFICIAL_PRESETS = [
  "Curious.pfpreset",
  "Happy.pfpreset",
  "Idle.pfpreset",
  "Thinking.pfpreset",
  "Sleepy.pfpreset",
  "Focused.pfpreset",
] as const;

describe("official presets", () => {
  for (const filename of OFFICIAL_PRESETS) {
    it(`loads ${filename} without plugin/graph motion overlaps`, () => {
      const json = readFileSync(join(PRESETS_DIR, filename), "utf8");
      const loaded = loadPreset(json);

      const overlapWarnings = loaded.warnings.filter((warning) =>
        warning.includes("produced by multiple stages"),
      );
      expect(overlapWarnings).toEqual([]);
    });
  }
});
