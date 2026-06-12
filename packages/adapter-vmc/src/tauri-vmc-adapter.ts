import type { Adapter } from "@puppetflow/adapter-core";
import { profileFromParamNames, VMC_PROFILE } from "@puppetflow/motion-mapper";
import { TauriOscAdapter, type TauriOscAdapterConfig } from "./tauri-osc-adapter.js";
import type { VmcAdapterConfig } from "./types.js";

export { setTauriOscEnabled, isTauriOscEnabled } from "./tauri-osc-adapter.js";

function toOscConfig(config?: VmcAdapterConfig): TauriOscAdapterConfig {
  if (!config) {
    return { id: "vmc-tauri", profile: VMC_PROFILE };
  }

  return {
    id: "vmc-tauri",
    host: config.host,
    port: config.port,
    profile:
      config.profile ??
      (config.mapping
        ? profileFromParamNames("vmc", config.mapping, "vmc-custom", "VMC Custom")
        : VMC_PROFILE),
  };
}

export class TauriVmcAdapter implements Adapter {
  readonly id = "vmc-tauri";
  private readonly inner: TauriOscAdapter;

  constructor(config?: VmcAdapterConfig) {
    this.inner = new TauriOscAdapter(toOscConfig(config));
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
