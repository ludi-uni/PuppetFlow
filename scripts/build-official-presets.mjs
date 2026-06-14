import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compilePfScript } from "../packages/pfscript-core/dist/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIRS = [
  join(ROOT, "packages/behavior-packs/presets"),
  join(ROOT, "presets"),
];

const BASE_GRAPH = (mouthGain) => ({
  nodes: [
    { id: "interest", type: "stateInput", data: { key: "interest" }, position: { x: 0, y: 80 } },
    { id: "multiply", type: "multiply", data: { gain: mouthGain }, position: { x: 220, y: 80 } },
    { id: "mouthX", type: "output", data: { key: "mouthX" }, position: { x: 460, y: 80 } },
  ],
  edges: [
    { id: "e1", source: "interest", target: "multiply" },
    { id: "e2", source: "multiply", target: "mouthX" },
  ],
});

const BLINK_IDLE_PLUGINS = [
  {
    id: "blink",
    config: { minInterval: 3, maxInterval: 8, closeDuration: 0.12, blinkStrength: 1 },
  },
  { id: "idle", config: { interestThreshold: 0.35, wanderBoost: 0.12 } },
];

/** @type {Record<string, {
  pfscript: string;
  mouthGain: number;
  behaviorPlugins?: unknown[];
  extensions?: { packs: unknown[] };
}>} */
const PRESET_VARIANTS = {
  Standard: {
    pfscript: `-- 体の揺れ
bodyLean = oscillator(id = "body", frequency = (0.3 * interest) + 0.1) * 0.1 * clamp(interest, 0.3, 1) + 0.5
bodyRoll = oscillator(id = "body", frequency = (0.3 * interest) + 0.1) * 0.1 * clamp(interest, 0.3, 1) + 0.5

-- 興味の度合いで前のめり
bodyYaw = interest * -0.3 + 0.5

-- RMSで口の開き
mouthY = volume

-- 疲れると眠そうに
eyeYaw = clamp(energy, 0.4, 1)

-- 呼吸
breath = breath(0.1)`,
    mouthGain: 0.5,
    behaviorPlugins: BLINK_IDLE_PLUGINS,
    extensions: { packs: [] },
  },
  Curious: {
    pfscript: `-- 体の揺れ（きょろきょろ）
bodyLean = oscillator(id = "body", frequency = (0.3 * interest) + 0.1) * 0.1 * clamp(interest, 0.3, 1) + 0.5
bodyRoll = oscillator(id = "body", frequency = (0.3 * interest) + 0.1) * 0.1 * clamp(interest, 0.3, 1) + 0.5
bodyYaw = interest * -0.3 + 0.5
mouthY = volume
eyeYaw = clamp(energy, 0.4, 1)
breath = breath(0.1)`,
    mouthGain: 0.5,
    behaviorPlugins: BLINK_IDLE_PLUGINS,
    extensions: { packs: [] },
  },
  Happy: {
    pfscript: `-- 体の揺れ（明るく活発）
bodyLean = oscillator(id = "body", frequency = (0.35 * interest) + 0.15) * 0.12 * clamp(interest, 0.2, 1) + 0.5
bodyRoll = oscillator(id = "body", frequency = (0.35 * interest) + 0.15) * 0.1 * clamp(interest, 0.2, 1) + 0.5
bodyYaw = interest * -0.2 + 0.5
mouthY = volume
eyeYaw = clamp(energy * 0.6 + 0.4, 0, 1)
breath = breath(0.12)`,
    mouthGain: 0.8,
    behaviorPlugins: BLINK_IDLE_PLUGINS,
    extensions: { packs: [] },
  },
  Idle: {
    pfscript: `-- 体の揺れ（ゆったり）
bodyLean = oscillator(id = "body", frequency = (0.2 * interest) + 0.08) * 0.06 * clamp(interest, 0.2, 1) + 0.5
bodyRoll = oscillator(id = "body", frequency = (0.2 * interest) + 0.08) * 0.05 * clamp(interest, 0.2, 1) + 0.5
bodyYaw = interest * -0.15 + 0.5
mouthY = volume
eyeYaw = clamp(energy, 0.35, 1)
breath = breath(0.08)`,
    mouthGain: 0.4,
    behaviorPlugins: BLINK_IDLE_PLUGINS,
    extensions: { packs: [] },
  },
  Thinking: {
    pfscript: `-- 体の揺れ（控えめ）
bodyLean = oscillator(id = "body", frequency = 0.15) * 0.05 + 0.5
bodyRoll = oscillator(id = "body", frequency = 0.12) * 0.04 + 0.5
bodyYaw = interest * -0.2 + 0.5
headTilt = 0.5 + clamp(interest, 0.5, 1) * 0.08
mouthY = volume
eyeYaw = clamp(energy, 0.45, 1)
breath = breath(0.09)`,
    mouthGain: 0.35,
    behaviorPlugins: [
      {
        id: "blink",
        config: { minInterval: 3, maxInterval: 8, closeDuration: 0.12, blinkStrength: 1 },
      },
      { id: "idle", config: { interestThreshold: 0.4, wanderBoost: 0.08 } },
    ],
    extensions: { packs: [{ id: "thinking", config: { intensity: 0.65 } }] },
  },
  Sleepy: {
    pfscript: `-- 体の揺れ（ゆっくり）
bodyLean = oscillator(id = "body", frequency = 0.1) * 0.05 * clamp(energy, 0.2, 1) + 0.5
bodyRoll = oscillator(id = "body", frequency = 0.08) * 0.04 + 0.5
bodyYaw = interest * -0.1 + 0.5
mouthY = volume * 0.85
eyeYaw = clamp(energy, 0.2, 0.75)
breath = breath(0.06)`,
    mouthGain: 0.3,
    behaviorPlugins: [
      {
        id: "blink",
        config: { minInterval: 4, maxInterval: 10, closeDuration: 0.18, blinkStrength: 1 },
      },
      { id: "idle", config: { interestThreshold: 0.45, wanderBoost: 0.08 } },
    ],
    extensions: { packs: [] },
  },
  Focused: {
    pfscript: `-- 体の揺れ（引き締め）
bodyLean = oscillator(id = "body", frequency = (0.25 * interest) + 0.08) * 0.04 * clamp(interest, 0.4, 1) + 0.5
bodyRoll = oscillator(id = "body", frequency = (0.25 * interest) + 0.08) * 0.03 * clamp(interest, 0.4, 1) + 0.5
bodyYaw = interest * -0.35 + 0.5
mouthY = volume
eyeYaw = clamp(energy, 0.5, 1)
breath = breath(0.08)`,
    mouthGain: 0.35,
    behaviorPlugins: [
      {
        id: "blink",
        config: { minInterval: 3, maxInterval: 8, closeDuration: 0.12, blinkStrength: 1 },
      },
      { id: "idle", config: { interestThreshold: 0.4, wanderBoost: 0.06 } },
    ],
    extensions: { packs: [] },
  },
};

function buildPreset(name, variant) {
  const behaviorPfScript = variant.pfscript.trim();
  const behavior = compilePfScript(behaviorPfScript);
  return {
    name,
    version: 3,
    behavior,
    behaviorPfScript,
    behaviorPlugins: variant.behaviorPlugins ?? BLINK_IDLE_PLUGINS,
    graph: BASE_GRAPH(variant.mouthGain),
    extensions: variant.extensions ?? { packs: [] },
  };
}

for (const outDir of OUT_DIRS) {
  mkdirSync(outDir, { recursive: true });
  for (const [name, variant] of Object.entries(PRESET_VARIANTS)) {
    const preset = buildPreset(name, variant);
    const json = `${JSON.stringify(preset, null, 2)}\n`;
    writeFileSync(join(outDir, `${name}.pfpreset`), json, "utf8");
  }
}

console.log(`Wrote ${Object.keys(PRESET_VARIANTS).length} presets to ${OUT_DIRS.join(", ")}`);
