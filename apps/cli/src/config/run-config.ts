import type { StateValue } from "@puppetflow/core";
import type {
  AdaptersLaunchConfig,
  SourceLaunchConfig,
} from "@puppetflow/runtime-launcher";

export interface RunCliOptions {
  configPath?: string;
  preset?: string;
  state?: string[];
  httpUrl?: string;
  wsUrl?: string;
  mqttBroker?: string;
  mqttTopic?: string;
  vmcHost?: string;
  vmcPort?: number;
  vmcDisabled?: boolean;
  live2d?: boolean;
  live2dHost?: string;
  live2dPort?: number;
  vrm?: boolean;
  vrmHost?: string;
  vrmPort?: number;
  websocketPort?: number;
  websocketDisabled?: boolean;
  loggerDisabled?: boolean;
  loggerThrottleMs?: number;
}

function parseStateAssignments(
  assignments: string[] | undefined,
): Record<string, StateValue> {
  const state: Record<string, StateValue> = {};
  for (const assignment of assignments ?? []) {
    const separator = assignment.indexOf("=");
    if (separator <= 0) {
      throw new Error(`Invalid --state value "${assignment}". Use key=value.`);
    }

    const key = assignment.slice(0, separator).trim();
    const rawValue = assignment.slice(separator + 1).trim();
    if (!key) {
      throw new Error(`Invalid --state value "${assignment}". Key is required.`);
    }

    if (rawValue === "true" || rawValue === "false") {
      state[key] = rawValue === "true";
      continue;
    }

    const numeric = Number(rawValue);
    if (!Number.isNaN(numeric) && rawValue.length > 0) {
      state[key] = numeric;
      continue;
    }

    state[key] = rawValue;
  }

  return state;
}

export function cliOptionsToOverrides(options: RunCliOptions): {
  preset?: string;
  initialState?: Record<string, StateValue>;
  sources: SourceLaunchConfig;
  adapters: AdaptersLaunchConfig;
} {
  const adapters: AdaptersLaunchConfig = {};

  if (options.vmcDisabled) {
    adapters.vmc = { enabled: false };
  } else if (options.vmcHost !== undefined || options.vmcPort !== undefined) {
    adapters.vmc = {
      enabled: true,
      host: options.vmcHost,
      port: options.vmcPort,
    };
  }

  if (options.live2d) {
    adapters.live2d = {
      enabled: true,
      host: options.live2dHost,
      port: options.live2dPort,
    };
  }

  if (options.vrm) {
    adapters.vrm = {
      enabled: true,
      host: options.vrmHost,
      port: options.vrmPort,
    };
  }

  if (options.websocketDisabled) {
    adapters.websocket = { enabled: false };
  } else if (options.websocketPort !== undefined) {
    adapters.websocket = {
      enabled: true,
      port: options.websocketPort,
    };
  }

  if (options.loggerDisabled) {
    adapters.logger = { enabled: false };
  } else if (options.loggerThrottleMs !== undefined) {
    adapters.logger = {
      enabled: true,
      throttleMs: options.loggerThrottleMs,
    };
  }

  return {
    preset: options.preset,
    initialState: parseStateAssignments(options.state),
    sources: {
      httpUrl: options.httpUrl ?? null,
      wsUrl: options.wsUrl ?? null,
      mqttBroker: options.mqttBroker ?? null,
      mqttTopic: options.mqttTopic ?? null,
    },
    adapters,
  };
}
