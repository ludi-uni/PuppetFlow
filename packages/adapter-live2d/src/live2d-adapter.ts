import type { Adapter } from "@puppetflow/adapter-core";
import { NodeOscAdapter } from "@puppetflow/adapter-vmc/node";
import {
  DEFAULT_VMC_HOST,
  DEFAULT_VMC_PORT,
  type VmcMapping,
} from "@puppetflow/adapter-vmc/node";
import {
  LIVE2D_PROFILE,
  profileFromParamNames,
  type MotionMapperProfile,
  type ValueTransform,
} from "@puppetflow/motion-mapper";

export interface Live2dAdapterConfig {
  host?: string;
  port?: number;
  mapping?: VmcMapping;
  profile?: MotionMapperProfile;
  customParams?: Record<string, string>;
  customTransforms?: Record<string, ValueTransform>;
}

export function createLive2dAdapter(config: Live2dAdapterConfig = {}): Adapter {
  const profile =
    config.profile ??
    (config.mapping
      ? profileFromParamNames(
          "live2d",
          config.mapping,
          "live2d-custom",
          "Live2D Custom",
        )
      : LIVE2D_PROFILE);

  return new NodeOscAdapter({
    id: "live2d",
    host: config.host ?? DEFAULT_VMC_HOST,
    port: config.port ?? DEFAULT_VMC_PORT,
    profile,
    customParams: config.customParams,
    customTransforms: config.customTransforms,
  });
}
