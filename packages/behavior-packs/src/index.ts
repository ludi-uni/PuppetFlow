import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PRESET_NAMES = [
  "Curious",
  "Happy",
  "Idle",
  "Thinking",
  "Sleepy",
  "Focused",
] as const;

export type BehaviorPackName = (typeof PRESET_NAMES)[number];

const PRESETS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../presets");

export function getPresetJson(name: BehaviorPackName): string {
  return readFileSync(resolve(PRESETS_DIR, `${name}.pfpreset`), "utf8");
}

export function listPresetNames(): readonly BehaviorPackName[] {
  return PRESET_NAMES;
}
