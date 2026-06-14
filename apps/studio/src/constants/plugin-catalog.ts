import { PLUGIN_MOTION_OUTPUTS, type MotionStateKey } from "@puppetflow/core";
import {
  OFFICIAL_BEHAVIOR_PLUGIN_IDS,
} from "@puppetflow/core";

export type CatalogPluginId = "gaze" | "blink" | "idle" | "attention" | "emotion";

export interface PluginParameterDef {
  key: string;
  label: string;
  simpleLabel: string;
  min: number;
  max: number;
  step: number;
  default: number;
  /** この値が影響する MotionState キー */
  motionKeys: MotionStateKey[];
}

export interface PluginCatalogEntry {
  id: CatalogPluginId;
  label: string;
  simpleLabel: string;
  description: string;
  motionOutputs: MotionStateKey[];
  parameters: PluginParameterDef[];
}

function catalogMotionOutputs(id: CatalogPluginId): MotionStateKey[] {
  const outputs = PLUGIN_MOTION_OUTPUTS[id];
  if (!outputs) {
    throw new Error(`Missing PLUGIN_MOTION_OUTPUTS for plugin id: ${id}`);
  }
  return [...outputs];
}

export const PLUGIN_CATALOG: PluginCatalogEntry[] = [
  {
    id: "gaze",
    label: "Gaze",
    simpleLabel: "視線のゆらぎ",
    description: "視線が左右・上下にゆっくり動きます（lookX / lookY）。Runtime では stateful oscillator を利用します",
    motionOutputs: catalogMotionOutputs("gaze"),
    parameters: [
      {
        key: "wanderAmplitude",
        label: "Wander amplitude",
        simpleLabel: "ゆらぎの大きさ",
        min: 0,
        max: 0.2,
        step: 0.005,
        default: 0.05,
        motionKeys: ["lookX", "lookY"],
      },
      {
        key: "speed",
        label: "Speed",
        simpleLabel: "ゆらぎの速さ",
        min: 0.05,
        max: 0.5,
        step: 0.05,
        default: 0.12,
        motionKeys: ["lookX", "lookY"],
      },
    ],
  },
  {
    id: "blink",
    label: "Blink",
    simpleLabel: "まばたき",
    description: "まばたきの間隔と閉じる強さを調整します（eyeYaw）。Runtime では stateful blink を利用します",
    motionOutputs: catalogMotionOutputs("blink"),
    parameters: [
      {
        key: "minInterval",
        label: "Min interval (s)",
        simpleLabel: "最短間隔（秒）",
        min: 1,
        max: 15,
        step: 0.5,
        default: 3,
        motionKeys: ["eyeYaw"],
      },
      {
        key: "maxInterval",
        label: "Max interval (s)",
        simpleLabel: "最長間隔（秒）",
        min: 2,
        max: 20,
        step: 0.5,
        default: 8,
        motionKeys: ["eyeYaw"],
      },
      {
        key: "closeDuration",
        label: "Close duration (s)",
        simpleLabel: "閉じる時間（秒）",
        min: 0.05,
        max: 0.4,
        step: 0.01,
        default: 0.12,
        motionKeys: ["eyeYaw"],
      },
      {
        key: "blinkStrength",
        label: "Blink strength",
        simpleLabel: "閉じる強さ",
        min: 0.05,
        max: 1,
        step: 0.01,
        default: 0.15,
        motionKeys: ["eyeYaw"],
      },
    ],
  },
  {
    id: "idle",
    label: "Idle",
    simpleLabel: "待機時の視線",
    description: "興味が低いとき視線が大きくゆらぎます（lookX / lookY）",
    motionOutputs: catalogMotionOutputs("idle"),
    parameters: [
      {
        key: "interestThreshold",
        label: "Interest threshold",
        simpleLabel: "発動する興味のしきい値",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.35,
        motionKeys: ["lookX", "lookY"],
      },
      {
        key: "wanderBoost",
        label: "Wander boost",
        simpleLabel: "ゆらぎの増え方",
        min: 0.02,
        max: 0.25,
        step: 0.01,
        default: 0.12,
        motionKeys: ["lookX", "lookY"],
      },
    ],
  },
  {
    id: "attention",
    label: "Attention",
    simpleLabel: "注目の姿勢",
    description: "興味に応じて体と頭が傾きます（bodyLean / headTilt）",
    motionOutputs: catalogMotionOutputs("attention"),
    parameters: [
      {
        key: "leanGain",
        label: "Lean gain",
        simpleLabel: "体の傾き",
        min: 0,
        max: 0.6,
        step: 0.05,
        default: 0.2,
        motionKeys: ["bodyLean"],
      },
      {
        key: "tiltGain",
        label: "Tilt gain",
        simpleLabel: "頭の傾き",
        min: 0,
        max: 0.4,
        step: 0.05,
        default: 0.1,
        motionKeys: ["headTilt"],
      },
    ],
  },
  {
    id: "emotion",
    label: "Emotion",
    simpleLabel: "感情の表情",
    description: "感情チャンネルから口・眉の動きを数値化します",
    motionOutputs: catalogMotionOutputs("emotion"),
    parameters: [
      {
        key: "joySmileGain",
        label: "Joy smile gain",
        simpleLabel: "喜びの笑顔",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.7,
        motionKeys: ["mouthX"],
      },
      {
        key: "sadnessBrowGain",
        label: "Sadness brow gain",
        simpleLabel: "悲しみの眉",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.5,
        motionKeys: ["facePitch"],
      },
      {
        key: "angerBrowGain",
        label: "Anger brow gain",
        simpleLabel: "怒りの眉",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.6,
        motionKeys: ["facePitch"],
      },
    ],
  },
];

export type PluginCatalogTier = "official" | "legacy";

export function getPluginCatalogTier(id: CatalogPluginId): PluginCatalogTier {
  if ((OFFICIAL_BEHAVIOR_PLUGIN_IDS as readonly string[]).includes(id)) {
    return "official";
  }
  return "legacy";
}

export function getPluginCatalogEntry(id: CatalogPluginId): PluginCatalogEntry {
  const entry = PLUGIN_CATALOG.find((plugin) => plugin.id === id);
  if (!entry) {
    throw new Error(`Unknown plugin id: ${id}`);
  }
  return entry;
}

export function getDefaultPluginConfig(id: CatalogPluginId): Record<string, number> {
  const entry = getPluginCatalogEntry(id);
  return Object.fromEntries(
    entry.parameters.map((parameter) => [parameter.key, parameter.default]),
  );
}
