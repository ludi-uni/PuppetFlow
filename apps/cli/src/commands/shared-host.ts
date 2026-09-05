import {
  createPuppetFlowHost,
  createSharedHostService,
  DEFAULT_ACTING_BONE_PROFILE,
  DEFAULT_EXPRESSION_PROFILE,
} from "@puppetflow/runtime-launcher/node";

import { resolveRunLaunchConfig } from "../config/resolve-run-config.js";
import type { RunCliOptions } from "../config/run-config.js";

const DEFAULT_AVATAR_INPUT_SERVICE = "puppetflow-host";

export interface SharedHostCliOptions extends RunCliOptions {
  controlPort?: number;
  controlOrigins?: string[];
  avatarInputWsUrl?: string;
}

export async function sharedHostCommand(options: SharedHostCliOptions): Promise<void> {
  const token = process.env.PUPPETFLOW_CONTROL_TOKEN;
  if (!token?.trim())
    throw new Error("PUPPETFLOW_CONTROL_TOKEN is required for shared-host");
  const launchConfig = await resolveRunLaunchConfig(options);
  const avatarInputCredential = resolveAvatarInputCredential(process.env);
  const host = createPuppetFlowHost({
    launchConfig,
    avatarInputWsUrl: options.avatarInputWsUrl,
    avatarInputCredential,
    onAvatarInputUnavailable: (reason) =>
      console.warn(`[pf] Avatar input unavailable: ${reason}`),
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

export function resolveAvatarInputCredential(
  environment: NodeJS.ProcessEnv,
): { service: string; token: string } | undefined {
  const token = environment.PUPPETFLOW_AVATAR_INPUT_SERVICE_TOKEN?.trim();
  const configuredService = environment.PUPPETFLOW_AVATAR_INPUT_SERVICE?.trim();
  if (!token) {
    if (configuredService) {
      throw new Error(
        "PUPPETFLOW_AVATAR_INPUT_SERVICE_TOKEN is required when an Avatar input service is configured",
      );
    }
    return undefined;
  }
  return {
    service: configuredService || DEFAULT_AVATAR_INPUT_SERVICE,
    token,
  };
}
