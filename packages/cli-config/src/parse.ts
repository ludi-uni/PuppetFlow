import type {
  AdaptersLaunchConfig,
  BehaviorApiLaunchConfig,
  RuntimeLaunchConfig,
  SourceLaunchConfig,
} from "@puppetflow/runtime-launcher";

import type { CliYamlConfig } from "./studio-export.js";
import { CLI_CONFIG_VERSION } from "./studio-export.js";

function yamlSourcesToLaunch(sources: CliYamlConfig["sources"]): SourceLaunchConfig {
  return {
    httpUrl: sources?.http ?? null,
    wsUrl: sources?.websocket ?? sources?.ws ?? null,
    mqttBroker: sources?.mqtt?.broker ?? null,
    mqttTopic: sources?.mqtt?.topic ?? null,
  };
}

function yamlAdaptersToLaunch(
  adapters: CliYamlConfig["adapters"],
): AdaptersLaunchConfig | undefined {
  if (!adapters) {
    return undefined;
  }

  return {
    vmc: adapters.vmc,
    live2d: adapters.live2d,
    vrm: adapters.vrm,
    websocket: adapters.websocket,
    logger: adapters.logger,
  };
}

function mergeSources(
  base: SourceLaunchConfig | undefined,
  overrides: SourceLaunchConfig,
): SourceLaunchConfig {
  return {
    httpUrl: overrides.httpUrl ?? base?.httpUrl ?? null,
    wsUrl: overrides.wsUrl ?? base?.wsUrl ?? null,
    mqttBroker: overrides.mqttBroker ?? base?.mqttBroker ?? null,
    mqttTopic: overrides.mqttTopic ?? base?.mqttTopic ?? null,
  };
}

function mergeAdapters(
  base: AdaptersLaunchConfig | undefined,
  overrides: AdaptersLaunchConfig,
): AdaptersLaunchConfig {
  return {
    vmc: { ...base?.vmc, ...overrides.vmc },
    live2d: { ...base?.live2d, ...overrides.live2d },
    vrm: { ...base?.vrm, ...overrides.vrm },
    websocket: { ...base?.websocket, ...overrides.websocket },
    logger: { ...base?.logger, ...overrides.logger },
  };
}

export function parseYamlConfig(raw: unknown): CliYamlConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("Config file must be a YAML object.");
  }

  const config = raw as CliYamlConfig;
  if (config.version !== undefined && config.version !== CLI_CONFIG_VERSION) {
    throw new Error(
      `Unsupported config version ${config.version}. Expected ${CLI_CONFIG_VERSION}.`,
    );
  }

  if (!config.preset && !config.presetName) {
    throw new Error("Config must include preset or presetName.");
  }

  return config;
}

export function yamlConfigToLaunchConfig(
  config: CliYamlConfig,
  presetJson: string,
): RuntimeLaunchConfig {
  return {
    presetJson,
    initialState: config.state,
    sources: yamlSourcesToLaunch(config.sources),
    adapters: yamlAdaptersToLaunch(config.adapters),
  };
}

export function mergeLaunchConfig(
  base: RuntimeLaunchConfig,
  overrides: {
    presetJson?: string;
    initialState?: Record<string, import("@puppetflow/core").StateValue>;
    sources?: SourceLaunchConfig;
    adapters?: AdaptersLaunchConfig;
    behaviorApi?: BehaviorApiLaunchConfig;
    customMicroBehaviors?: RuntimeLaunchConfig["customMicroBehaviors"];
  },
): RuntimeLaunchConfig {
  return {
    presetJson: overrides.presetJson ?? base.presetJson,
    initialState: {
      ...base.initialState,
      ...overrides.initialState,
    },
    sources: mergeSources(base.sources, overrides.sources ?? {}),
    adapters: mergeAdapters(base.adapters, overrides.adapters ?? {}),
    behaviorApi: overrides.behaviorApi ?? base.behaviorApi,
    customMicroBehaviors: overrides.customMicroBehaviors ?? base.customMicroBehaviors,
  };
}
