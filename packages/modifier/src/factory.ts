import type { MotionModifier } from "@puppetflow/modifier-core";
import { BreathModifier, type BreathModifierConfig } from "./breath-modifier.js";
import { NoiseModifier, type NoiseModifierConfig } from "./noise-modifier.js";
import {
  SmoothingModifier,
  type SmoothingModifierConfig,
} from "./smoothing-modifier.js";

export interface ModifierConfigEntry {
  id: string;
  config?: Record<string, unknown>;
}

export function createModifier(entry: ModifierConfigEntry): MotionModifier {
  switch (entry.id) {
    case "breath":
      return new BreathModifier(entry.config as BreathModifierConfig | undefined);
    case "noise":
      return new NoiseModifier(entry.config as NoiseModifierConfig | undefined);
    case "smoothing":
      return new SmoothingModifier(entry.config as SmoothingModifierConfig | undefined);
    default:
      throw new Error(`Unknown modifier id: ${entry.id}`);
  }
}

export function createModifiers(entries: ModifierConfigEntry[]): MotionModifier[] {
  return entries.map(createModifier);
}
