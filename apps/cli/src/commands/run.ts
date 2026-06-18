import { buildRuntime } from "@puppetflow/runtime-launcher/node";
import { startBehaviorHttpServer, type BehaviorHttpServer } from "@puppetflow/micro-behavior/node";

import { resolveRunLaunchConfig } from "../config/resolve-run-config.js";
import type { RunCliOptions } from "../config/run-config.js";

function describeLaunchSummary(options: RunCliOptions): void {
  const parts: string[] = [];
  if (options.configPath) {
    parts.push(`config=${options.configPath}`);
  }
  if (options.preset) {
    parts.push(`preset=${options.preset}`);
  }
  if (options.httpUrl) {
    parts.push(`http=${options.httpUrl}`);
  }
  if (options.wsUrl) {
    parts.push(`ws=${options.wsUrl}`);
  }
  if (options.mqttBroker && options.mqttTopic) {
    parts.push(`mqtt=${options.mqttBroker}/${options.mqttTopic}`);
  }

  console.log(`PuppetFlow CLI run (${parts.join(", ") || "defaults"})`);
}

export async function runCommand(options: RunCliOptions): Promise<void> {
  describeLaunchSummary(options);

  const launchConfig = await resolveRunLaunchConfig(options);
  const runtime = buildRuntime(launchConfig);

  await runtime.start();

  let behaviorServer: BehaviorHttpServer | null = null;
  const behaviorApi = launchConfig.behaviorApi;
  if (behaviorApi?.enabled !== false && behaviorApi?.port !== undefined) {
    behaviorServer = await startBehaviorHttpServer({
      host: behaviorApi.host ?? "127.0.0.1",
      port: behaviorApi.port,
      engine: runtime.microBehavior,
    });
    console.log(`Behavior API -> ${behaviorServer.url}`);
  }

  const customCount = launchConfig.customMicroBehaviors?.length ?? 0;
  if (customCount > 0) {
    console.log(`Custom micro behaviors -> ${customCount} loaded`);
  }

  const vmc = launchConfig.adapters?.vmc;
  const vmcEnabled = vmc?.enabled ?? true;
  if (vmcEnabled) {
    const host = vmc?.host ?? "127.0.0.1";
    const port = vmc?.port ?? 39539;
    console.log(`VMC OSC -> ${host}:${port}`);
  }

  const sources = launchConfig.sources;
  if (sources?.httpUrl) {
    console.log(`HTTP source -> ${sources.httpUrl}`);
  }
  if (sources?.wsUrl) {
    console.log(`WebSocket source -> ${sources.wsUrl}`);
  }
  if (sources?.mqttBroker && sources?.mqttTopic) {
    console.log(`MQTT source -> ${sources.mqttBroker} topic ${sources.mqttTopic}`);
  }

  console.log("Press Ctrl+C to exit.");

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`\nStopping PuppetFlow runtime (${signal})...`);

    try {
      if (behaviorServer) {
        await behaviorServer.close();
      }
      await runtime.stop();
      console.log("PuppetFlow runtime stopped.");
    } catch (error) {
      console.error("[pf] Failed to stop runtime cleanly.", error);
      process.exitCode = 1;
    } finally {
      process.exit(process.exitCode ?? 0);
    }
  };

  const onSignal = (signal: NodeJS.Signals | "SIGBREAK") => {
    void shutdown(signal);
  };

  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  process.once("SIGBREAK" as NodeJS.Signals, onSignal);

  await new Promise<void>(() => {
    // Keep alive until a shutdown signal calls process.exit().
  });
}
