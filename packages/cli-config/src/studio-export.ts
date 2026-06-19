import type { StateValue } from "@puppetflow/core";

import {
  studioOscMapperToYamlForTarget,
  type StudioOscMapperModel,
} from "./mapper-yaml.js";

export const CLI_CONFIG_VERSION = 2;
export const SUPPORTED_CLI_CONFIG_VERSIONS = [1, 2] as const;
export const DEFAULT_CLI_MICRO_BEHAVIORS_FILE = "./micro-behaviors.pfmicrobehaviors";

export const BUILTIN_CLI_PRESET_NAMES = [
  "Curious",
  "Happy",
  "Idle",
  "Thinking",
  "Sleepy",
  "Focused",
] as const;

export type BuiltinCliPresetName = (typeof BUILTIN_CLI_PRESET_NAMES)[number];

export type {
  CustomMappingEntryYaml,
  OscAdapterYamlConfig,
  StudioOscMapperModel,
} from "./mapper-yaml.js";

export interface CliYamlConfig {
  version?: number;
  preset?: string;
  presetName?: string;
  state?: Record<string, StateValue>;
  sources?: {
    http?: string;
    websocket?: string;
    ws?: string;
    mqtt?: {
      broker?: string;
      topic?: string;
    };
  };
  adapters?: {
    vmc?: import("./mapper-yaml.js").OscAdapterYamlConfig;
    live2d?: import("./mapper-yaml.js").OscAdapterYamlConfig;
    vrm?: import("./mapper-yaml.js").OscAdapterYamlConfig;
    websocket?: {
      enabled?: boolean;
      port?: number;
    };
    logger?: {
      enabled?: boolean;
      throttleMs?: number;
      label?: string;
    };
  };
  /** Relative path to .pfmicrobehaviors JSON from config file directory */
  microBehaviors?: string;
}

export interface StudioCliExportInput {
  presetName: string;
  isCustomPreset: boolean;
  sources: {
    httpUrl?: string | null;
    wsUrl?: string | null;
    mqttBroker?: string | null;
    mqttTopic?: string | null;
  };
  mapperConfig: {
    vmc: StudioOscMapperModel;
    live2d: StudioOscMapperModel;
    vrm: StudioOscMapperModel;
    loggerEnabled: boolean;
    loggerThrottleMs: number;
  };
  initialState?: Record<string, StateValue>;
  includeMicroBehaviorsFile?: boolean;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isBuiltinPresetName(name: string): name is BuiltinCliPresetName {
  return (BUILTIN_CLI_PRESET_NAMES as readonly string[]).includes(name);
}

function sanitizePresetFileName(name: string): string {
  const trimmed = name.trim() || "preset";
  return trimmed.replace(/[^\w.-]+/g, "-");
}

export function buildCliYamlFromStudio(input: StudioCliExportInput): CliYamlConfig {
  const config: CliYamlConfig = {
    version: CLI_CONFIG_VERSION,
  };

  if (input.isCustomPreset) {
    config.preset = `./${sanitizePresetFileName(input.presetName)}.pfpreset`;
  } else if (isBuiltinPresetName(input.presetName)) {
    config.presetName = input.presetName;
  } else {
    config.preset = `./${sanitizePresetFileName(input.presetName)}.pfpreset`;
  }

  const stateEntries = Object.entries(input.initialState ?? {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  if (stateEntries.length > 0) {
    config.state = Object.fromEntries(stateEntries);
  }

  const sources: NonNullable<CliYamlConfig["sources"]> = {};
  if (hasText(input.sources.httpUrl)) {
    sources.http = input.sources.httpUrl.trim();
  }
  if (hasText(input.sources.wsUrl)) {
    sources.websocket = input.sources.wsUrl.trim();
  }
  if (hasText(input.sources.mqttBroker) && hasText(input.sources.mqttTopic)) {
    sources.mqtt = {
      broker: input.sources.mqttBroker.trim(),
      topic: input.sources.mqttTopic.trim(),
    };
  }
  if (Object.keys(sources).length > 0) {
    config.sources = sources;
  }

  config.adapters = {
    vmc: studioOscMapperToYamlForTarget("vmc", input.mapperConfig.vmc),
    live2d: studioOscMapperToYamlForTarget("live2d", input.mapperConfig.live2d),
    vrm: studioOscMapperToYamlForTarget("vrm", input.mapperConfig.vrm),
    logger: {
      enabled: input.mapperConfig.loggerEnabled,
      throttleMs: input.mapperConfig.loggerThrottleMs,
      label: "PuppetFlow CLI",
    },
  };

  if (input.includeMicroBehaviorsFile) {
    config.microBehaviors = DEFAULT_CLI_MICRO_BEHAVIORS_FILE;
  }

  return config;
}
