import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { loadPreset, type LoadedPreset } from "./load-preset.js";

export async function readPresetFile(filePath: string): Promise<LoadedPreset> {
  const json = await readFile(filePath, "utf8");
  return loadPreset(json);
}

export function readPresetFileSync(filePath: string): LoadedPreset {
  const json = readFileSync(filePath, "utf8");
  return loadPreset(json);
}

export async function readPresetFileContents(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

export function readPresetFileContentsSync(filePath: string): string {
  return readFileSync(filePath, "utf8");
}
