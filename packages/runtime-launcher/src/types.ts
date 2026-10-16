import type { MotionStateKey, StateValue } from "@puppetflow/core";
import type { VmcTimestampMode } from "@puppetflow/adapter-vmc";
import type { ValueTransform } from "@puppetflow/motion-mapper";
import type { MicroBehaviorDefinition } from "@puppetflow/micro-behavior";
import type { VmcInputProfileId, VmcRootPolicy } from "@puppetflow/source-vmc";

export type VmcInputLaunchConfig = {
  enabled?: boolean;
  host?: string;
  port?: number;
  profile?: VmcInputProfileId;
  positionScale?: number;
  rootPolicy?: VmcRootPolicy;
};

export type SourceLaunchConfig = {
  httpUrl?: string | null;
  wsUrl?: string | null;
  mqttBroker?: string | null;
  mqttTopic?: string | null;
  vmc?: VmcInputLaunchConfig;
};

export type CustomMappingLaunchEntry = {
  param: string;
  transform?: ValueTransform;
};

export type OscAdapterLaunchConfig = {
  enabled?: boolean;
  host?: string;
  port?: number;
  params?: Partial<Record<MotionStateKey, string>>;
  transforms?: Partial<Record<MotionStateKey, ValueTransform>>;
  custom?: Record<string, CustomMappingLaunchEntry>;
  outputRateHz?: number;
  timestampMode?: VmcTimestampMode;
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
  behaviorApi?: BehaviorApiLaunchConfig;
  customMicroBehaviors?: MicroBehaviorDefinition[];
};

export type BehaviorApiLaunchConfig = {
  enabled?: boolean;
  host?: string;
  port?: number;
};
