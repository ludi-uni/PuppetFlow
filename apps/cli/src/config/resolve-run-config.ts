import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import {
  getPresetJson,
  listPresetNames,
  type BehaviorPackName,
} from "@puppetflow/behavior-packs";
import {
  mergeLaunchConfig,
  parseYamlConfig,
  yamlConfigToLaunchConfig,
} from "@puppetflow/cli-config";
import { parseMicroBehaviorsFile } from "@puppetflow/micro-behavior";
import { readPresetFileContents } from "@puppetflow/preset/node";
import { parse as parseYaml } from "yaml";

import { cliOptionsToOverrides, type RunCliOptions } from "./run-config.js";
import type { RuntimeLaunchConfig } from "@puppetflow/runtime-launcher";

const BUILTIN_PRESET_NAMES = new Set<string>(listPresetNames());

function getWorkspaceCwd(): string {
  return process.env.INIT_CWD ?? process.cwd();
}

function isBuiltinPresetName(value: string): value is BehaviorPackName {
  return BUILTIN_PRESET_NAMES.has(value);
}

export async function resolvePresetJson(
  presetInput: string,
  baseDir = getWorkspaceCwd(),
): Promise<string> {
  if (isBuiltinPresetName(presetInput)) {
    return getPresetJson(presetInput);
  }

  const filePath = isAbsolute(presetInput)
    ? presetInput
    : resolve(baseDir, presetInput);

  return readPresetFileContents(filePath);
}

export async function loadYamlConfigFile(configPath: string): Promise<{
  config: import("@puppetflow/cli-config").CliYamlConfig;
  baseDir: string;
}> {
  const absolutePath = isAbsolute(configPath)
    ? configPath
    : resolve(getWorkspaceCwd(), configPath);
  const raw = await readFile(absolutePath, "utf8");
  const parsed = parseYaml(raw);
  return {
    config: parseYamlConfig(parsed),
    baseDir: resolve(absolutePath, ".."),
  };
}

async function loadMicroBehaviorsFile(
  filePath: string,
  baseDir: string,
): Promise<import("@puppetflow/micro-behavior").MicroBehaviorDefinition[]> {
  const absolutePath = isAbsolute(filePath) ? filePath : resolve(baseDir, filePath);
  const raw = await readFile(absolutePath, "utf8");
  return parseMicroBehaviorsFile(JSON.parse(raw));
}

async function attachMicroBehaviors(
  launchConfig: RuntimeLaunchConfig,
  filePath: string | undefined,
  baseDir: string,
): Promise<RuntimeLaunchConfig> {
  if (!filePath) {
    return launchConfig;
  }

  return {
    ...launchConfig,
    customMicroBehaviors: await loadMicroBehaviorsFile(filePath, baseDir),
  };
}

export async function resolveRunLaunchConfig(
  options: RunCliOptions,
): Promise<RuntimeLaunchConfig> {
  let launchConfig: RuntimeLaunchConfig | null = null;
  let configBaseDir = getWorkspaceCwd();

  if (options.configPath) {
    const { config, baseDir } = await loadYamlConfigFile(options.configPath);
    configBaseDir = baseDir;
    const presetInput = config.presetName ?? config.preset;
    if (!presetInput) {
      throw new Error("Config must include preset or presetName.");
    }

    const presetJson = await resolvePresetJson(presetInput, baseDir);
    launchConfig = await attachMicroBehaviors(
      yamlConfigToLaunchConfig(config, presetJson),
      config.microBehaviors,
      baseDir,
    );
  }

  const overrides = cliOptionsToOverrides(options);
  const microBehaviorsPath = overrides.microBehaviorsPath;

  if (!launchConfig) {
    if (!overrides.preset) {
      throw new Error("Specify --preset <name-or-path> or --config <yaml>.");
    }

    launchConfig = {
      presetJson: await resolvePresetJson(overrides.preset),
      initialState: overrides.initialState,
      sources: overrides.sources,
      adapters: overrides.adapters,
      behaviorApi: overrides.behaviorApi,
    };
    launchConfig = await attachMicroBehaviors(
      launchConfig,
      microBehaviorsPath,
      configBaseDir,
    );
    return launchConfig;
  }

  if (overrides.preset) {
    launchConfig = mergeLaunchConfig(launchConfig, {
      presetJson: await resolvePresetJson(overrides.preset),
    });
  }

  const merged = mergeLaunchConfig(launchConfig, {
    initialState: overrides.initialState,
    sources: overrides.sources,
    adapters: overrides.adapters,
    behaviorApi: overrides.behaviorApi,
  });

  if (microBehaviorsPath) {
    return attachMicroBehaviors(merged, microBehaviorsPath, configBaseDir);
  }

  return merged;
}
