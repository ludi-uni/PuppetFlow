import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPreset } from "./load-preset.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("examples/pfscript presets", () => {
  it("loads pfscript-demo.pfpreset", () => {
    const json = readFileSync(
      join(repoRoot, "examples/pfscript/pfscript-demo.pfpreset"),
      "utf8",
    );
    const loaded = loadPreset(json);
    expect(loaded.behaviorPfScript).toContain("smile");
    expect(loaded.behavior.statements.length).toBeGreaterThan(0);
  });
});
