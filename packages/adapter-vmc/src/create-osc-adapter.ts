import type { Adapter } from "@puppetflow/adapter-core";
import { NodeOscAdapter } from "./node-osc-adapter.js";
import type { VmcAdapterConfig } from "./types.js";
import { profileFromParamNames } from "@puppetflow/motion-mapper";

export function createOscMappingAdapter(id: string, config: VmcAdapterConfig): Adapter {
  const profile =
    config.profile ??
    profileFromParamNames(
      "custom",
      config.mapping ?? {},
      `${id}-custom`,
      `${id} custom`,
    );

  return new NodeOscAdapter({
    id,
    host: config.host,
    port: config.port,
    profile,
  });
}
