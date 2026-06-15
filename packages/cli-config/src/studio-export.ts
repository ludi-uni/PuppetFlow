import type { StateValue } from "@puppetflow/core";

export const CLI_CONFIG_VERSION = 1;

export const BUILTIN_CLI_PRESET_NAMES = [
  "Curious",
  "Happy",
  "Idle",
  "Thinking",
  "Sleepy",
  "Focused",
] as const;

export type BuiltinCliPresetName = (typeof BUILTIN_CLI_PRESET_NAMES)[number];

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
    vmc?: {
      enabled?: boolean;
      host?: string;
      port?: number;
    };
    live2d?: {
      enabled?: boolean;
      host?: string;
      port?: number;
    };
    vrm?: {
      enabled?: boolean;
      host?: string;
      port?: number;
    };
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
}

export interface StudioMapperExportModel {
  enabled: boolean;
  host: string;
  port: number;
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
    vmc: StudioMapperExportModel;
    live2d: StudioMapperExportModel;
    vrm: StudioMapperExportModel;
    loggerEnabled: boolean;
    loggerThrottleMs: number;
  };
  initialState?: Record<string, StateValue>;
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
    vmc: {
      enabled: input.mapperConfig.vmc.enabled,
      host: input.mapperConfig.vmc.host,
      port: input.mapperConfig.vmc.port,
    },
    live2d: {
      enabled: input.mapperConfig.live2d.enabled,
      host: input.mapperConfig.live2d.host,
      port: input.mapperConfig.live2d.port,
    },
    vrm: {
      enabled: input.mapperConfig.vrm.enabled,
      host: input.mapperConfig.vrm.host,
      port: input.mapperConfig.vrm.port,
    },
    logger: {
      enabled: input.mapperConfig.loggerEnabled,
      throttleMs: input.mapperConfig.loggerThrottleMs,
      label: "PuppetFlow CLI",
    },
  };

  return config;
}
