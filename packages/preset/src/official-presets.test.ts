import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPreset } from "./load-preset.js";
import type { PuppetFlowPreset } from "./types.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const PACKAGE_PRESETS_DIR = join(ROOT, "packages/behavior-packs/presets");
const ROOT_PRESETS_DIR = join(ROOT, "presets");

const OFFICIAL_PRESETS = [
  "Standard",
  "Curious",
  "Happy",
  "Idle",
  "Thinking",
  "Sleepy",
  "Focused",
] as const;

type OfficialPresetName = (typeof OFFICIAL_PRESETS)[number];

function readPreset(directory: string, name: OfficialPresetName): PuppetFlowPreset {
  return JSON.parse(
    readFileSync(join(directory, `${name}.pfpreset`), "utf8"),
  ) as PuppetFlowPreset;
}

function graphGain(preset: PuppetFlowPreset): unknown {
  return preset.graph.nodes.find((node) => node.id === "multiply")?.data.gain;
}

const STANDARD_PFSCRIPT = `-- 体の揺れ
bodyLean = oscillator(id = "body", frequency = (0.3 * interest) + 0.1) * 0.1 * clamp(interest, 0.3, 1) + 0.5
bodyRoll = oscillator(id = "body", frequency = (0.3 * interest) + 0.1) * 0.1 * clamp(interest, 0.3, 1) + 0.5

-- 興味の度合いで前のめり
bodyYaw = interest * -0.3 + 0.5

-- RMSで口の開き
mouthY = volume

-- 疲れると眠そうに
eyeYaw = clamp(energy, 0.4, 1)

-- 呼吸
breath = breath(0.1)`;

const STANDARD_PLUGINS = [
  {
    id: "blink",
    config: {
      minInterval: 3,
      maxInterval: 8,
      closeDuration: 0.12,
      blinkStrength: 1,
    },
  },
  { id: "idle", config: { interestThreshold: 0.35, wanderBoost: 0.12 } },
];

const MOUTH_CONTRACT: Record<
  OfficialPresetName,
  { mouthY: string; mouthXGain: number }
> = {
  Standard: { mouthY: "mouthY = volume", mouthXGain: 0.5 },
  Curious: { mouthY: "mouthY = volume", mouthXGain: 0.5 },
  Happy: { mouthY: "mouthY = volume", mouthXGain: 0.8 },
  Idle: { mouthY: "mouthY = volume", mouthXGain: 0.4 },
  Thinking: { mouthY: "mouthY = volume", mouthXGain: 0.35 },
  Sleepy: { mouthY: "mouthY = volume * 0.85", mouthXGain: 0.3 },
  Focused: { mouthY: "mouthY = volume", mouthXGain: 0.35 },
};

describe("official presets", () => {
  for (const name of OFFICIAL_PRESETS) {
    it(`loads ${name}.pfpreset without plugin/graph motion overlaps`, () => {
      const filename = `${name}.pfpreset`;
      const json = readFileSync(join(PACKAGE_PRESETS_DIR, filename), "utf8");
      const loaded = loadPreset(json);

      const overlapWarnings = loaded.warnings.filter((warning) =>
        warning.includes("produced by multiple stages"),
      );
      expect(overlapWarnings).toEqual([]);
    });
  }

  it("keeps Standard as the exact neutral baseline", () => {
    const preset = readPreset(PACKAGE_PRESETS_DIR, "Standard");

    expect(preset.behaviorPfScript).toBe(STANDARD_PFSCRIPT);
    expect(preset.behaviorPlugins).toEqual(STANDARD_PLUGINS);
    expect(preset.extensions).toEqual({ packs: [] });
    expect(graphGain(preset)).toBe(0.5);
  });

  it.each(OFFICIAL_PRESETS)("preserves %s mouth behavior", (name) => {
    const preset = readPreset(PACKAGE_PRESETS_DIR, name);
    const contract = MOUTH_CONTRACT[name];
    const mouthLines = preset.behaviorPfScript
      ?.split("\n")
      .filter((line) => line.trimStart().startsWith("mouthY ="));

    expect(mouthLines).toEqual([contract.mouthY]);
    expect(graphGain(preset)).toBe(contract.mouthXGain);
  });

  it.each(OFFICIAL_PRESETS)("keeps both generated copies of %s identical", (name) => {
    const filename = `${name}.pfpreset`;
    expect(readFileSync(join(PACKAGE_PRESETS_DIR, filename), "utf8")).toBe(
      readFileSync(join(ROOT_PRESETS_DIR, filename), "utf8"),
    );
  });
});
