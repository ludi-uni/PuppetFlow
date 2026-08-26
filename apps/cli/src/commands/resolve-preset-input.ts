import { isAbsolute, resolve } from "node:path";

import { loadYamlConfigFile, resolvePresetJson } from "../config/resolve-run-config.js";

export interface PresetInputOptions {
  configPath?: string;
  preset?: string;
}

export interface ResolvedPresetInput {
  presetJson: string;
  sourcePath?: string;
}

function getWorkspaceCwd(): string {
  return process.env.INIT_CWD ?? process.cwd();
}

function looksLikePresetPath(value: string): boolean {
  return value.endsWith(".pfpreset") || value.includes("/") || value.includes("\\");
}

export async function resolvePresetInput(
  options: PresetInputOptions,
): Promise<ResolvedPresetInput> {
  const hasConfig = options.configPath !== undefined;
  const hasPreset = options.preset !== undefined;
  if (hasConfig === hasPreset) {
    throw new Error("Specify exactly one of --preset or --config.");
  }

  if (hasConfig) {
    const { config, baseDir } = await loadYamlConfigFile(options.configPath!);
    const presetInput = config.presetName ?? config.preset;
    if (!presetInput) {
      throw new Error("Config must include preset or presetName.");
    }

    return {
      presetJson: await resolvePresetJson(presetInput, baseDir),
      sourcePath: looksLikePresetPath(presetInput)
        ? isAbsolute(presetInput)
          ? presetInput
          : resolve(baseDir, presetInput)
        : undefined,
    };
  }

  return {
    presetJson: await resolvePresetJson(options.preset!),
    sourcePath: looksLikePresetPath(options.preset!)
      ? isAbsolute(options.preset!)
        ? options.preset
        : resolve(getWorkspaceCwd(), options.preset!)
      : undefined,
  };
}
