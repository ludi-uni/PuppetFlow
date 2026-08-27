import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BehaviorBlock } from "@puppetflow/behavior";
import { compilePfScript } from "@puppetflow/pfscript-core";
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

function assignedKeys(
  preset: Pick<PuppetFlowPreset, "behaviorPfScript"> & {
    behavior?: BehaviorBlock;
  },
): string[] {
  const behavior = preset.behavior ?? compilePfScript(preset.behaviorPfScript ?? "");

  const collect = (statements: BehaviorBlock["statements"]): string[] =>
    statements.flatMap((statement) => {
      switch (statement.type) {
        case "ExprAssign":
          return [statement.target];
        case "If":
          return [
            ...collect(statement.then),
            ...(statement.else ? collect(statement.else) : []),
          ];
        case "Block":
          return collect(statement.statements);
        default:
          return [];
      }
    });

  return collect(behavior.statements);
}

function pluginConfig(preset: PuppetFlowPreset, id: string): unknown {
  return preset.behaviorPlugins?.find((plugin) => plugin.id === id)?.config;
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

const PERSONALITY_CONTRACT = {
  Curious: {
    assignments: ["faceYaw", "headTilt"],
    blink: {
      minInterval: 3,
      maxInterval: 8,
      closeDuration: 0.12,
      blinkStrength: 1,
    },
    idle: { interestThreshold: 0.5, wanderBoost: 0.1 },
  },
  Happy: {
    assignments: ["facePitch", "headTilt"],
    blink: {
      minInterval: 2.8,
      maxInterval: 7,
      closeDuration: 0.11,
      blinkStrength: 1,
    },
    idle: { interestThreshold: 0.3, wanderBoost: 0.08 },
  },
  Idle: {
    assignments: ["faceYaw", "headTilt"],
    blink: {
      minInterval: 3.5,
      maxInterval: 8.5,
      closeDuration: 0.13,
      blinkStrength: 1,
    },
    idle: { interestThreshold: 0.5, wanderBoost: 0.07 },
  },
  Thinking: {
    assignments: [],
    blink: {
      minInterval: 3,
      maxInterval: 8,
      closeDuration: 0.12,
      blinkStrength: 1,
    },
    idle: { interestThreshold: 0.4, wanderBoost: 0.06 },
  },
  Sleepy: {
    assignments: ["facePitch", "headTilt"],
    blink: {
      minInterval: 4,
      maxInterval: 10,
      closeDuration: 0.18,
      blinkStrength: 1,
    },
    idle: { interestThreshold: 0.5, wanderBoost: 0.05 },
  },
  Focused: {
    assignments: ["facePitch", "headTilt"],
    blink: {
      minInterval: 3,
      maxInterval: 8,
      closeDuration: 0.12,
      blinkStrength: 1,
    },
    idle: { interestThreshold: 0.3, wanderBoost: 0.03 },
  },
} as const;

const RESTRICTED_ASSIGNMENT_KEYS = new Set([
  "faceYaw",
  "facePitch",
  "headTilt",
  "lookX",
  "lookY",
]);

const MOTION_SOURCE_CONTRACT = {
  Curious: [
    'faceYaw = oscillator(id = "curious-face-yaw", frequency = 0.12) * 0.045 + 0.5',
    'headTilt = oscillator(id = "curious-head-tilt", frequency = 0.17) * 0.035 + 0.5',
  ],
  Happy: [
    'facePitch = oscillator(id = "happy-face-pitch", frequency = 0.42) * 0.025 + 0.5',
    'headTilt = oscillator(id = "happy-head-tilt", frequency = 0.31) * 0.02 + 0.5',
  ],
  Idle: [
    'faceYaw = oscillator(id = "idle-face-yaw", frequency = 0.07) * 0.015 + 0.5',
    'headTilt = oscillator(id = "idle-head-tilt", frequency = 0.05) * 0.01 + 0.5',
  ],
  Sleepy: [
    'facePitch = oscillator(id = "sleepy-face-pitch", frequency = 0.06) * 0.01 + 0.47',
    'headTilt = oscillator(id = "sleepy-head-tilt", frequency = 0.05) * 0.015 + 0.5',
  ],
  Focused: [
    'facePitch = oscillator(id = "focused-face-pitch", frequency = 0.12) * 0.008 + 0.48',
    'headTilt = oscillator(id = "focused-head-tilt", frequency = 0.09) * 0.008 + 0.5',
  ],
} as const;

describe("official presets", () => {
  it("detects duplicate restricted assignments inside compiled conditional blocks", () => {
    const preset = readPreset(PACKAGE_PRESETS_DIR, "Standard");
    const loaded = loadPreset(
      JSON.stringify({
        ...preset,
        behaviorPfScript: `if interest > 0.5 then
  headTilt = 0.51
  headTilt = 0.52
end`,
      }),
    );

    expect(assignedKeys(loaded)).toEqual(["headTilt", "headTilt"]);
  });

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

  it("uses the stronger concave Energy curve for Curious eye openness", () => {
    const preset = readPreset(PACKAGE_PRESETS_DIR, "Curious");

    expect(preset.behaviorPfScript).toContain(
      "eyeYaw = clamp(1 - (1 - energy) * (1 - energy), 0.4, 1)",
    );
  });

  it.each(OFFICIAL_PRESETS)("keeps both generated copies of %s identical", (name) => {
    const filename = `${name}.pfpreset`;
    expect(readFileSync(join(PACKAGE_PRESETS_DIR, filename), "utf8")).toBe(
      readFileSync(join(ROOT_PRESETS_DIR, filename), "utf8"),
    );
  });

  it.each(Object.entries(PERSONALITY_CONTRACT))(
    "gives %s its approved motion ownership and plugin profile",
    (name, contract) => {
      const preset = readPreset(
        PACKAGE_PRESETS_DIR,
        name as keyof typeof PERSONALITY_CONTRACT,
      );
      const loaded = loadPreset(JSON.stringify(preset));
      const keys = assignedKeys(loaded).filter((key) =>
        RESTRICTED_ASSIGNMENT_KEYS.has(key),
      );

      expect(keys).toEqual(contract.assignments);
      expect(pluginConfig(preset, "blink")).toEqual(contract.blink);
      expect(pluginConfig(preset, "idle")).toEqual(contract.idle);
    },
  );

  it("leaves Thinking head and face pose ownership to the Thinking Pack", () => {
    const preset = readPreset(PACKAGE_PRESETS_DIR, "Thinking");
    const keys = assignedKeys(loadPreset(JSON.stringify(preset))).filter((key) =>
      RESTRICTED_ASSIGNMENT_KEYS.has(key),
    );

    expect(keys).not.toContain("headTilt");
    expect(keys).not.toContain("facePitch");
    expect(preset.extensions).toEqual({
      packs: [{ id: "thinking", config: { intensity: 0.5 } }],
    });
  });

  it.each(Object.entries(MOTION_SOURCE_CONTRACT))(
    "keeps %s head and face motion within the approved first-pass bounds",
    (name, expectedLines) => {
      const source = readPreset(
        PACKAGE_PRESETS_DIR,
        name as keyof typeof MOTION_SOURCE_CONTRACT,
      ).behaviorPfScript;

      for (const line of expectedLines) expect(source).toContain(line);
    },
  );
});
