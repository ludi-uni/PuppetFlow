import { writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import { parsePreset } from "@puppetflow/preset";

import { resolvePresetInput, type PresetInputOptions } from "./resolve-preset-input.js";

export interface CompileCliOptions extends PresetInputOptions {
  output?: string;
}

export async function compileCommand(options: CompileCliOptions): Promise<void> {
  if (!options.output) {
    throw new Error("Compile requires --output <path>.");
  }

  const input = await resolvePresetInput(options);
  const outputPath = isAbsolute(options.output)
    ? options.output
    : resolve(process.cwd(), options.output);
  if (input.sourcePath && resolve(input.sourcePath) === resolve(outputPath)) {
    throw new Error("Compile output must not overwrite the input preset.");
  }

  const preset = parsePreset(input.presetJson);
  await writeFile(outputPath, `${JSON.stringify(preset, null, 2)}\n`, "utf8");
  console.log(`Compiled preset: ${preset.name} -> ${outputPath}`);
}
