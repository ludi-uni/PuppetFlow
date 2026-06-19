import type {
  AdaptersLaunchConfig,
  BehaviorApiLaunchConfig,
  RuntimeLaunchConfig,
  SourceLaunchConfig,
} from "@puppetflow/runtime-launcher";

import {
  oscAdapterYamlToLaunchConfig,
  parseOscAdapterYamlConfig,
} from "./mapper-yaml.js";
import type { CliYamlConfig } from "./studio-export.js";
import { SUPPORTED_CLI_CONFIG_VERSIONS } from "./studio-export.js";

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
    vmc: oscAdapterYamlToLaunchConfig(
      parseOscAdapterYamlConfig("vmc", adapters.vmc, "adapters.vmc"),
    ),
    live2d: oscAdapterYamlToLaunchConfig(
      parseOscAdapterYamlConfig("live2d", adapters.live2d, "adapters.live2d"),
    ),
    vrm: oscAdapterYamlToLaunchConfig(
      parseOscAdapterYamlConfig("vrm", adapters.vrm, "adapters.vrm"),
    ),
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

function mergeOscAdapterLaunchConfig(
  base: AdaptersLaunchConfig["vmc"],
  overrides: AdaptersLaunchConfig["vmc"],
): AdaptersLaunchConfig["vmc"] {
  if (!base && !overrides) {
    return undefined;
  }

  return {
    ...base,
    ...overrides,
    params: overrides?.params ?? base?.params,
    transforms: overrides?.transforms ?? base?.transforms,
    custom: overrides?.custom ?? base?.custom,
  };
}

function mergeAdapters(
  base: AdaptersLaunchConfig | undefined,
  overrides: AdaptersLaunchConfig,
): AdaptersLaunchConfig {
  return {
    vmc: mergeOscAdapterLaunchConfig(base?.vmc, overrides.vmc),
    live2d: mergeOscAdapterLaunchConfig(base?.live2d, overrides.live2d),
    vrm: mergeOscAdapterLaunchConfig(base?.vrm, overrides.vrm),
    websocket: { ...base?.websocket, ...overrides.websocket },
    logger: { ...base?.logger, ...overrides.logger },
  };
}

export function parseYamlConfig(raw: unknown): CliYamlConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("Config file must be a YAML object.");
  }

  const config = raw as CliYamlConfig;
  if (
    config.version !== undefined &&
    !(SUPPORTED_CLI_CONFIG_VERSIONS as readonly number[]).includes(config.version)
  ) {
    throw new Error(
      `Unsupported config version ${config.version}. Expected one of ${SUPPORTED_CLI_CONFIG_VERSIONS.join(", ")}.`,
    );
  }

  if (!config.preset && !config.presetName) {
    throw new Error("Config must include preset or presetName.");
  }

  if (config.adapters) {
    parseOscAdapterYamlConfig("vmc", config.adapters.vmc, "adapters.vmc");
    parseOscAdapterYamlConfig("live2d", config.adapters.live2d, "adapters.live2d");
    parseOscAdapterYamlConfig("vrm", config.adapters.vrm, "adapters.vrm");
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
