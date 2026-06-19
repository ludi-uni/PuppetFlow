import type { Adapter } from "@puppetflow/adapter-core";
import {
  profileFromParamNames,
  VMC_PROFILE,
  type MotionMapperProfile,
} from "@puppetflow/motion-mapper";
import { NodeOscAdapter } from "./node-osc-adapter.js";
import { DEFAULT_VMC_HOST, DEFAULT_VMC_PORT, type VmcAdapterConfig } from "./types.js";

function resolveProfile(config: VmcAdapterConfig): MotionMapperProfile {
  if (config.profile) {
    return config.profile;
  }

  if (config.mapping) {
    return profileFromParamNames("vmc", config.mapping, "vmc-custom", "VMC Custom");
  }

  return VMC_PROFILE;
}

export class NodeVmcAdapter implements Adapter {
  readonly id = "vmc-node";
  private readonly inner: NodeOscAdapter;

  constructor(config: VmcAdapterConfig = { mapping: {} }) {
    this.inner = new NodeOscAdapter({
      id: "vmc-node",
      host: config.host ?? DEFAULT_VMC_HOST,
      port: config.port ?? DEFAULT_VMC_PORT,
      profile: resolveProfile(config),
      customParams: config.customParams,
      customTransforms: config.customTransforms,
    });
  }

  initialize(): Promise<void> {
    return this.inner.initialize();
  }

  update(motion: Parameters<Adapter["update"]>[0], deltaTime: number): Promise<void> {
    return this.inner.update(motion, deltaTime);
  }

  dispose(): Promise<void> {
    return this.inner.dispose();
  }
}
