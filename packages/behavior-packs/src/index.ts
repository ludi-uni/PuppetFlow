import curiousPreset from "../presets/Curious.pfpreset";
import focusedPreset from "../presets/Focused.pfpreset";
import happyPreset from "../presets/Happy.pfpreset";
import idlePreset from "../presets/Idle.pfpreset";
import sleepyPreset from "../presets/Sleepy.pfpreset";
import thinkingPreset from "../presets/Thinking.pfpreset";

export const PRESET_NAMES = [
  "Curious",
  "Happy",
  "Idle",
  "Thinking",
  "Sleepy",
  "Focused",
] as const;

export type BehaviorPackName = (typeof PRESET_NAMES)[number];

const PRESETS: Record<BehaviorPackName, string> = {
  Curious: curiousPreset,
  Happy: happyPreset,
  Idle: idlePreset,
  Thinking: thinkingPreset,
  Sleepy: sleepyPreset,
  Focused: focusedPreset,
};

export function getPresetJson(name: BehaviorPackName): string {
  return PRESETS[name];
}

export function listPresetNames(): readonly BehaviorPackName[] {
  return PRESET_NAMES;
}
