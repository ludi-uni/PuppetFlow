import { LoggerAdapter } from "@puppetflow/adapter-logger";
import { createLive2dAdapter } from "@puppetflow/adapter-live2d";
import { NodeVmcAdapter } from "@puppetflow/adapter-vmc/node";
import { createVrmAdapter } from "@puppetflow/adapter-vrm";
import { WebSocketAdapter } from "@puppetflow/adapter-websocket";
import type { PuppetFlowRuntime } from "@puppetflow/runtime";

import type { AdaptersLaunchConfig } from "./types.js";

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

export function attachNodeAdapters(
  runtime: PuppetFlowRuntime,
  adapters: AdaptersLaunchConfig = DEFAULT_ADAPTERS,
): void {
  const vmc = adapters.vmc ?? DEFAULT_ADAPTERS.vmc;
  if (isEnabled(vmc, true)) {
    runtime.attachAdapter(
      new NodeVmcAdapter({
        host: vmc?.host,
        port: vmc?.port,
      }),
    );
  }

  const live2d = adapters.live2d;
  if (isEnabled(live2d, false)) {
    runtime.attachAdapter(
      createLive2dAdapter({
        host: live2d?.host,
        port: live2d?.port,
      }),
    );
  }

  const vrm = adapters.vrm;
  if (isEnabled(vrm, false)) {
    runtime.attachAdapter(
      createVrmAdapter({
        host: vrm?.host,
        port: vrm?.port,
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
