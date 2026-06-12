import type { Adapter } from "@puppetflow/adapter-core";
import { NodeOscAdapter } from "@puppetflow/adapter-vmc/node";
import {
  DEFAULT_VMC_HOST,
  DEFAULT_VMC_PORT,
  type VmcMapping,
} from "@puppetflow/adapter-vmc/node";
import {
  profileFromParamNames,
  VRM_PROFILE,
  type MotionMapperProfile,
} from "@puppetflow/motion-mapper";

export interface VrmAdapterConfig {
  host?: string;
  port?: number;
  mapping?: VmcMapping;
  profile?: MotionMapperProfile;
}

export function createVrmAdapter(config: VrmAdapterConfig = {}): Adapter {
  const profile =
    config.profile ??
    (config.mapping
      ? profileFromParamNames("vrm", config.mapping, "vrm-custom", "VRM Custom")
      : VRM_PROFILE);

  return new NodeOscAdapter({
    id: "vrm",
    host: config.host ?? DEFAULT_VMC_HOST,
    port: config.port ?? DEFAULT_VMC_PORT,
    profile,
  });
}
