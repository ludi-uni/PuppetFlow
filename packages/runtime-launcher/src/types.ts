import type { StateValue } from "@puppetflow/core";

export type SourceLaunchConfig = {
  httpUrl?: string | null;
  wsUrl?: string | null;
  mqttBroker?: string | null;
  mqttTopic?: string | null;
};

export type OscAdapterLaunchConfig = {
  enabled?: boolean;
  host?: string;
  port?: number;
};

export type AdaptersLaunchConfig = {
  vmc?: OscAdapterLaunchConfig;
  live2d?: OscAdapterLaunchConfig;
  vrm?: OscAdapterLaunchConfig;
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

export type RuntimeLaunchConfig = {
  presetJson: string;
  initialState?: Record<string, StateValue>;
  sources?: SourceLaunchConfig;
  adapters?: AdaptersLaunchConfig;
};
