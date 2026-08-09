import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { materializePresetBehavior } from "./compile-behavior.js";
import type { BehaviorPluginConfig } from "./plugin-factory.js";
import type { PuppetFlowPreset } from "./types.js";
import { compilePfScript } from "@puppetflow/pfscript-core";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT_DIRS = [join(ROOT, "packages/behavior-packs/presets"), join(ROOT, "presets")];

const BASE_GRAPH = (mouthGain: number) => ({
  nodes: [
    {
      id: "interest",
      type: "stateInput",
      data: { key: "interest" },
      position: { x: 0, y: 80 },
    },
    {
      id: "multiply",
      type: "multiply",
      data: { gain: mouthGain },
      position: { x: 220, y: 80 },
    },
    {
      id: "mouthX",
      type: "output",
      data: { key: "mouthX" },
      position: { x: 460, y: 80 },
    },
  ],
  edges: [
    { id: "e1", source: "interest", target: "multiply" },
    { id: "e2", source: "multiply", target: "mouthX" },
  ],
});

const BLINK_IDLE_PLUGINS: BehaviorPluginConfig[] = [
  {
    id: "blink",
    config: { minInterval: 3, maxInterval: 8, closeDuration: 0.12, blinkStrength: 1 },
  },
  { id: "idle", config: { interestThreshold: 0.35, wanderBoost: 0.12 } },
];

interface PresetVariant {
  pfscript: string;
  mouthGain: number;
  behaviorPlugins?: BehaviorPluginConfig[];
  extensions?: PuppetFlowPreset["extensions"];
}

const PRESET_VARIANTS: Record<string, PresetVariant> = {
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
bodyLean = oscillator(id = "curious-body-lean", frequency = (0.28 * interest) + 0.08) * 0.075 * clamp(interest, 0.3, 1) + 0.5
bodyRoll = oscillator(id = "curious-body-roll", frequency = (0.22 * interest) + 0.07) * 0.06 * clamp(interest, 0.3, 1) + 0.5
faceYaw = oscillator(id = "curious-face-yaw", frequency = 0.12) * 0.045 + 0.5
headTilt = oscillator(id = "curious-head-tilt", frequency = 0.17) * 0.035 + 0.5
bodyYaw = interest * -0.3 + 0.5
mouthY = volume
eyeYaw = clamp(energy, 0.4, 1)
breath = breath(0.1)`,
    mouthGain: 0.5,
    behaviorPlugins: [
      {
        id: "blink",
        config: {
          minInterval: 3,
          maxInterval: 8,
          closeDuration: 0.12,
          blinkStrength: 1,
        },
      },
      { id: "idle", config: { interestThreshold: 0.5, wanderBoost: 0.1 } },
    ],
    extensions: { packs: [] },
  },
  Happy: {
    pfscript: `-- 体の揺れ（明るく活発）
bodyLean = oscillator(id = "happy-body-lean", frequency = (0.32 * interest) + 0.14) * 0.09 * clamp(interest, 0.2, 1) + 0.5
bodyRoll = oscillator(id = "happy-body-roll", frequency = (0.27 * interest) + 0.12) * 0.07 * clamp(interest, 0.2, 1) + 0.5
facePitch = oscillator(id = "happy-face-pitch", frequency = 0.42) * 0.025 + 0.5
headTilt = oscillator(id = "happy-head-tilt", frequency = 0.31) * 0.02 + 0.5
bodyYaw = interest * -0.2 + 0.5
mouthY = volume
eyeYaw = clamp(energy * 0.6 + 0.4, 0, 1)
breath = breath(0.12)`,
    mouthGain: 0.8,
    behaviorPlugins: [
      {
        id: "blink",
        config: {
          minInterval: 2.8,
          maxInterval: 7,
          closeDuration: 0.11,
          blinkStrength: 1,
        },
      },
      { id: "idle", config: { interestThreshold: 0.3, wanderBoost: 0.08 } },
    ],
    extensions: { packs: [] },
  },
  Idle: {
    pfscript: `-- 体の揺れ（ゆったり）
bodyLean = oscillator(id = "idle-body-lean", frequency = 0.12) * 0.04 * clamp(interest, 0.2, 1) + 0.5
bodyRoll = oscillator(id = "idle-body-roll", frequency = 0.09) * 0.03 * clamp(interest, 0.2, 1) + 0.5
faceYaw = oscillator(id = "idle-face-yaw", frequency = 0.07) * 0.015 + 0.5
headTilt = oscillator(id = "idle-head-tilt", frequency = 0.05) * 0.01 + 0.5
bodyYaw = interest * -0.15 + 0.5
mouthY = volume
eyeYaw = clamp(energy, 0.35, 1)
breath = breath(0.08)`,
    mouthGain: 0.4,
    behaviorPlugins: [
      {
        id: "blink",
        config: {
          minInterval: 3.5,
          maxInterval: 8.5,
          closeDuration: 0.13,
          blinkStrength: 1,
        },
      },
      { id: "idle", config: { interestThreshold: 0.5, wanderBoost: 0.07 } },
    ],
    extensions: { packs: [] },
  },
  Thinking: {
    pfscript: `-- 体の揺れ（控えめ）
bodyLean = oscillator(id = "thinking-body-lean", frequency = 0.15) * 0.04 + 0.5
bodyRoll = oscillator(id = "thinking-body-roll", frequency = 0.11) * 0.03 + 0.5
bodyYaw = interest * -0.2 + 0.5
mouthY = volume
eyeYaw = clamp(energy, 0.45, 1)
breath = breath(0.09)`,
    mouthGain: 0.35,
    behaviorPlugins: [
      {
        id: "blink",
        config: {
          minInterval: 3,
          maxInterval: 8,
          closeDuration: 0.12,
          blinkStrength: 1,
        },
      },
      { id: "idle", config: { interestThreshold: 0.4, wanderBoost: 0.06 } },
    ],
    extensions: { packs: [{ id: "thinking", config: { intensity: 0.5 } }] },
  },
  Sleepy: {
    pfscript: `-- 体の揺れ（ゆっくり）
bodyLean = oscillator(id = "sleepy-body-lean", frequency = 0.1) * 0.035 * clamp(energy, 0.2, 1) + 0.5
bodyRoll = oscillator(id = "sleepy-body-roll", frequency = 0.07) * 0.025 + 0.5
facePitch = oscillator(id = "sleepy-face-pitch", frequency = 0.06) * 0.01 + 0.47
headTilt = oscillator(id = "sleepy-head-tilt", frequency = 0.05) * 0.015 + 0.5
bodyYaw = interest * -0.1 + 0.5
mouthY = volume * 0.85
eyeYaw = clamp(energy, 0.2, 0.75)
breath = breath(0.06)`,
    mouthGain: 0.3,
    behaviorPlugins: [
      {
        id: "blink",
        config: {
          minInterval: 4,
          maxInterval: 10,
          closeDuration: 0.18,
          blinkStrength: 1,
        },
      },
      { id: "idle", config: { interestThreshold: 0.5, wanderBoost: 0.05 } },
    ],
    extensions: { packs: [] },
  },
  Focused: {
    pfscript: `-- 体の揺れ（引き締め）
bodyLean = oscillator(id = "focused-body-lean", frequency = (0.22 * interest) + 0.08) * 0.035 * clamp(interest, 0.4, 1) + 0.5
bodyRoll = oscillator(id = "focused-body-roll", frequency = (0.18 * interest) + 0.07) * 0.025 * clamp(interest, 0.4, 1) + 0.5
facePitch = oscillator(id = "focused-face-pitch", frequency = 0.12) * 0.008 + 0.48
headTilt = oscillator(id = "focused-head-tilt", frequency = 0.09) * 0.008 + 0.5
bodyYaw = interest * -0.35 + 0.5
mouthY = volume
eyeYaw = clamp(energy, 0.5, 1)
breath = breath(0.08)`,
    mouthGain: 0.35,
    behaviorPlugins: [
      {
        id: "blink",
        config: {
          minInterval: 3,
          maxInterval: 8,
          closeDuration: 0.12,
          blinkStrength: 1,
        },
      },
      { id: "idle", config: { interestThreshold: 0.3, wanderBoost: 0.03 } },
    ],
    extensions: { packs: [] },
  },
};

function buildPreset(name: string, variant: PresetVariant): PuppetFlowPreset {
  const behaviorPfScript = variant.pfscript.trim();
  return materializePresetBehavior({
    name,
    version: 3,
    behavior: compilePfScript(behaviorPfScript),
    behaviorPfScript,
    behaviorPlugins: variant.behaviorPlugins ?? BLINK_IDLE_PLUGINS,
    graph: BASE_GRAPH(variant.mouthGain),
    extensions: variant.extensions ?? { packs: [] },
  });
}

for (const outDir of OUT_DIRS) {
  mkdirSync(outDir, { recursive: true });
  for (const [name, variant] of Object.entries(PRESET_VARIANTS)) {
    const preset = buildPreset(name, variant);
    const json = `${JSON.stringify(preset, null, 2)}\n`;
    writeFileSync(join(outDir, `${name}.pfpreset`), json, "utf8");
  }
}

console.log(
  `Wrote ${Object.keys(PRESET_VARIANTS).length} presets to ${OUT_DIRS.join(", ")}`,
);
