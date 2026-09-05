import {
  createPuppetFlowHost,
  createSharedHostService,
  DEFAULT_ACTING_BONE_PROFILE,
  DEFAULT_EXPRESSION_PROFILE,
} from "@puppetflow/runtime-launcher/node";

import { resolveRunLaunchConfig } from "../config/resolve-run-config.js";
import type { RunCliOptions } from "../config/run-config.js";

export interface SharedHostCliOptions extends RunCliOptions {
  controlPort?: number;
  controlOrigins?: string[];
}

export async function sharedHostCommand(options: SharedHostCliOptions): Promise<void> {
  const token = process.env.PUPPETFLOW_CONTROL_TOKEN;
  if (!token?.trim())
    throw new Error("PUPPETFLOW_CONTROL_TOKEN is required for shared-host");
  const launchConfig = await resolveRunLaunchConfig(options);
  const host = createPuppetFlowHost({
    launchConfig,
    acting: {
      profile: DEFAULT_ACTING_BONE_PROFILE,
      expressionProfile: DEFAULT_EXPRESSION_PROFILE,
    },
  });
  const service = createSharedHostService({
    host,
    token,
    port: options.controlPort ?? 8788,
    origins: options.controlOrigins ?? [],
  });
  await service.start();
  console.log(`PuppetFlow shared Host -> ${service.url}`);
  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await service.close();
    } catch (error) {
      console.error("[pf] Failed to stop shared Host cleanly.", error);
      process.exitCode = 1;
    } finally {
      process.exit(process.exitCode ?? 0);
    }
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGBREAK" as NodeJS.Signals, () => void shutdown());
  await new Promise<void>(() => {});
}
