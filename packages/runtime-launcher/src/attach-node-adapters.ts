import { LoggerAdapter } from "@puppetflow/adapter-logger";
import { createLive2dAdapter } from "@puppetflow/adapter-live2d";
import { NodeVmcAdapter } from "@puppetflow/adapter-vmc/node";
import { createVrmAdapter } from "@puppetflow/adapter-vrm";
import { WebSocketAdapter } from "@puppetflow/adapter-websocket";
import type { PuppetFlowRuntime } from "@puppetflow/runtime";

import {
  buildMotionMapperProfileFromLaunch,
  customMappingsFromLaunch,
} from "./mapper-launch.js";
import type { AdaptersLaunchConfig, OscAdapterLaunchConfig } from "./types.js";

const DEFAULT_ADAPTERS: AdaptersLaunchConfig = {
  vmc: { enabled: true },
  logger: { enabled: true, throttleMs: 5000, label: "PuppetFlow" },
};

function isEnabled(
  config: { enabled?: boolean } | undefined,
  fallback: boolean,
): boolean {
  return config?.enabled ?? fallback;
}

function resolveOscAdapterOptions(
  target: "vmc" | "live2d" | "vrm",
  config: OscAdapterLaunchConfig,
) {
  const profile = buildMotionMapperProfileFromLaunch(target, config);
  const { customParams, customTransforms } = customMappingsFromLaunch(config);

  return {
    host: config.host,
    port: config.port,
    profile,
    customParams,
    customTransforms,
  };
}

export function attachNodeAdapters(
  runtime: PuppetFlowRuntime,
  adapters: AdaptersLaunchConfig = DEFAULT_ADAPTERS,
): void {
  const vmc = adapters.vmc ?? DEFAULT_ADAPTERS.vmc;
  if (isEnabled(vmc, true) && vmc) {
    runtime.attachAdapter(
      new NodeVmcAdapter({
        ...resolveOscAdapterOptions("vmc", vmc),
      }),
    );
  }

  const live2d = adapters.live2d;
  if (isEnabled(live2d, false) && live2d) {
    runtime.attachAdapter(
      createLive2dAdapter({
        ...resolveOscAdapterOptions("live2d", live2d),
      }),
    );
  }

  const vrm = adapters.vrm;
  if (isEnabled(vrm, false) && vrm) {
    runtime.attachAdapter(
      createVrmAdapter({
        ...resolveOscAdapterOptions("vrm", vrm),
      }),
    );
  }

  const websocket = adapters.websocket;
  if (isEnabled(websocket, false)) {
    runtime.attachAdapter(
      new WebSocketAdapter({
        port: websocket?.port ?? 3939,
      }),
    );
  }

  const logger = adapters.logger ?? DEFAULT_ADAPTERS.logger;
  if (isEnabled(logger, true)) {
    runtime.attachAdapter(
      new LoggerAdapter({
        label: logger?.label ?? "PuppetFlow",
        throttleMs: logger?.throttleMs ?? 5000,
      }),
    );
  }
}
