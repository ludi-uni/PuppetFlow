import type { MotionStateKey } from "@puppetflow/core";
import type { MotionMapperProfile } from "@puppetflow/motion-mapper";

export type VmcMapping = Partial<Record<MotionStateKey, string>>;

export interface VmcAdapterConfig {
  host?: string;
  port?: number;
  mapping?: VmcMapping;
  profile?: MotionMapperProfile;
}

export const DEFAULT_VMC_HOST = "127.0.0.1";
export const DEFAULT_VMC_PORT = 39539;
