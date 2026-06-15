#!/usr/bin/env node

import { Command } from "commander";

import { runCommand } from "./commands/run.js";

const program = new Command();

program.name("pf").description("PuppetFlow headless CLI").version("0.1.0");

program
  .command("run")
  .description("Run PuppetFlow with a preset and optional input sources")
  .option("-c, --config <path>", "YAML config file")
  .option("-p, --preset <name-or-path>", "Built-in preset name or .pfpreset path")
  .option("--state <key=value>", "Initial state assignment (repeatable)", collect, [])
  .option("--http-url <url>", "HTTP polling source URL")
  .option("--ws-url <url>", "WebSocket input source URL")
  .option("--mqtt-broker <url>", "MQTT broker URL")
  .option("--mqtt-topic <topic>", "MQTT topic")
  .option("--vmc-host <host>", "VMC OSC host")
  .option("--vmc-port <port>", "VMC OSC port", parsePort)
  .option("--no-vmc", "Disable VMC OSC output")
  .option("--live2d", "Enable Live2D OSC adapter")
  .option("--live2d-host <host>", "Live2D OSC host")
  .option("--live2d-port <port>", "Live2D OSC port", parsePort)
  .option("--vrm", "Enable VRM OSC adapter")
  .option("--vrm-host <host>", "VRM OSC host")
  .option("--vrm-port <port>", "VRM OSC port", parsePort)
  .option(
    "--websocket-port <port>",
    "Enable WebSocket motion broadcast on port",
    parsePort,
  )
  .option("--no-websocket", "Disable WebSocket adapter from config")
  .option("--no-logger", "Disable throttled motion logger")
  .option("--logger-throttle-ms <ms>", "Logger throttle interval", parsePositiveInt)
  .action(async (options) => {
    try {
      await runCommand({
        configPath: options.config,
        preset: options.preset,
        state: options.state,
        httpUrl: options.httpUrl,
        wsUrl: options.wsUrl,
        mqttBroker: options.mqttBroker,
        mqttTopic: options.mqttTopic,
        vmcHost: options.vmcHost,
        vmcPort: options.vmcPort,
        vmcDisabled: options.vmc === false,
        live2d: options.live2d,
        live2dHost: options.live2dHost,
        live2dPort: options.live2dPort,
        vrm: options.vrm,
        vrmHost: options.vrmHost,
        vrmPort: options.vrmPort,
        websocketPort: options.websocketPort,
        websocketDisabled: options.websocket === false,
        loggerDisabled: options.logger === false,
        loggerThrottleMs: options.loggerThrottleMs,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[pf] ${message}`);
      process.exitCode = 1;
    }
  });

function collect(value: string, previous: string[]): string[] {
  return previous.concat(value);
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

function parsePositiveInt(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid integer: ${value}`);
  }
  return parsed;
}

await program.parseAsync(process.argv);
