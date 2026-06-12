import { loadPreset } from "@puppetflow/preset";

export function validatePresetJson(json: string): string | null {
  try {
    loadPreset(json);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid preset JSON";
  }
}
