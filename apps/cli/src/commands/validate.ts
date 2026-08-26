import { loadPreset } from "@puppetflow/preset";

import { resolvePresetInput, type PresetInputOptions } from "./resolve-preset-input.js";

export type ValidateCliOptions = PresetInputOptions;

export async function validateCommand(options: ValidateCliOptions): Promise<void> {
  const { presetJson } = await resolvePresetInput(options);
  const loaded = loadPreset(presetJson);
  console.log(`Valid preset: ${loaded.name}`);
  if (loaded.warnings.length > 0) {
    console.log(`Warnings: ${loaded.warnings.length}`);
  }
}
