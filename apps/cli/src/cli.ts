#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Command } from "commander";

import { recordCommand, type RecordCliOptions } from "./commands/record.js";
import { replayCommand, type ReplayCliOptions } from "./commands/replay.js";
import { compileCommand, type CompileCliOptions } from "./commands/compile.js";
import { validateCommand, type ValidateCliOptions } from "./commands/validate.js";
import { runCommand } from "./commands/run.js";
import type { RunCliOptions } from "./config/run-config.js";
import {
  sharedHostCommand,
  type SharedHostCliOptions,
} from "./commands/shared-host.js";

export interface CliActions {
  run(options: RunCliOptions): Promise<void>;
  record(options: RecordCliOptions): Promise<void>;
  replay(options: ReplayCliOptions): Promise<void>;
  validate?(options: ValidateCliOptions): Promise<void>;
  compile?(options: CompileCliOptions): Promise<void>;
  sharedHost?(options: SharedHostCliOptions): Promise<void>;
}

const defaultActions: CliActions = {
  run: runCommand,
  record: recordCommand,
  replay: replayCommand,
  validate: validateCommand,
  compile: compileCommand,
  sharedHost: sharedHostCommand,
};

export function createProgram(actions: CliActions = defaultActions): Command {
  const program = new Command();
  program.name("pf").description("PuppetFlow headless CLI").version("0.1.0");

  const run = program
    .command("run")
    .description("Run PuppetFlow with a preset and optional input sources");
  addRunOptions(run).action(async (options) => {
    await actions.run(toRunOptions(options));
  });

  const record = program
    .command("record <output>")
    .description("Record canonical motion frames to a streaming JSONL file");
  addRunOptions(record)
    .option("--duration <ms>", "Stop after this duration", parseNonNegativeInt)
    .action(async (output, options) => {
      await actions.record({
        ...toRunOptions(options),
        output,
        durationMs: options.duration,
      });
    });

  const sharedHost = program
    .command("shared-host")
    .description("Start one loopback-only shared PuppetFlow Host");
  addRunOptions(sharedHost)
    .option("--control-port <port>", "Control HTTP port", parsePort)
    .option(
      "--control-origin <origin>",
      "Allowed browser Origin (repeatable)",
      collect,
      [],
    )
    .action(async (options) => {
      await (actions.sharedHost ?? sharedHostCommand)({
        ...toRunOptions(options),
        controlPort: options.controlPort,
        controlOrigins: options.controlOrigin,
      });
    });

  program
    .command("replay <input>")
    .description("Replay canonical motion frames")
    .option("--speed <factor>", "Playback speed factor", parsePositiveNumber)
    .option("--loop", "Loop at end of recording")
    .option(
      "--start-offset <ms>",
      "Skip frames before this timestamp",
      parseNonNegativeNumber,
    )
    .option("--vmc-host <host>", "VMC OSC host")
    .option("--vmc-port <port>", "VMC OSC port", parsePort)
    .action(async (input, options) => {
      await actions.replay({
        input,
        speed: options.speed,
        loop: options.loop,
        startOffsetMs: options.startOffset,
        vmcHost: options.vmcHost,
        vmcPort: options.vmcPort,
      });
    });

  const validate = program
    .command("validate")
    .description("Validate a preset or YAML config without starting runtime");
  addPresetInputOptions(validate).action(async (options) => {
    await (actions.validate ?? validateCommand)(toPresetInputOptions(options));
  });

  const compile = program
    .command("compile")
    .description("Compile a preset into canonical Preset v3 JSON");
  addPresetInputOptions(compile)
    .requiredOption("-o, --output <path>", "Compiled .pfpreset output path")
    .action(async (options) => {
      await (actions.compile ?? compileCommand)({
        ...toPresetInputOptions(options),
        output: options.output,
      });
    });

  return program;
}

function addPresetInputOptions(command: Command): Command {
  return command
    .option("-c, --config <path>", "YAML config file")
    .option("-p, --preset <name-or-path>", "Built-in preset name or .pfpreset path");
}

function addRunOptions(command: Command): Command {
  return command
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
    .option(
      "--logger-throttle-ms <ms>",
      "Logger throttle interval",
      parseNonNegativeInt,
    )
    .option("--behavior-port <port>", "Enable Behavior HTTP API on port", parsePort)
    .option("--behavior-host <host>", "Behavior HTTP API bind host")
    .option("--no-behavior-api", "Disable Behavior HTTP API")
    .option(
      "--micro-behaviors <path>",
      "Load custom micro behaviors from .pfmicrobehaviors JSON",
    );
}

function toRunOptions(options: Record<string, unknown>): RunCliOptions {
  return {
    configPath: options.config as string | undefined,
    preset: options.preset as string | undefined,
    state: options.state as string[] | undefined,
    httpUrl: options.httpUrl as string | undefined,
    wsUrl: options.wsUrl as string | undefined,
    mqttBroker: options.mqttBroker as string | undefined,
    mqttTopic: options.mqttTopic as string | undefined,
    vmcHost: options.vmcHost as string | undefined,
    vmcPort: options.vmcPort as number | undefined,
    vmcDisabled: options.vmc === false,
    live2d: options.live2d as boolean | undefined,
    live2dHost: options.live2dHost as string | undefined,
    live2dPort: options.live2dPort as number | undefined,
    vrm: options.vrm as boolean | undefined,
    vrmHost: options.vrmHost as string | undefined,
    vrmPort: options.vrmPort as number | undefined,
    websocketPort: options.websocketPort as number | undefined,
    websocketDisabled: options.websocket === false,
    loggerDisabled: options.logger === false,
    loggerThrottleMs: options.loggerThrottleMs as number | undefined,
    behaviorPort: options.behaviorPort as number | undefined,
    behaviorHost: options.behaviorHost as string | undefined,
    behaviorDisabled: options.behaviorApi === false,
    microBehaviorsPath: options.microBehaviors as string | undefined,
  };
}

function toPresetInputOptions(options: Record<string, unknown>): ValidateCliOptions {
  return {
    configPath: options.config as string | undefined,
    preset: options.preset as string | undefined,
  };
}

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

function parseNonNegativeInt(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid non-negative integer: ${value}`);
  }
  return parsed;
}

function parseNonNegativeNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid non-negative number: ${value}`);
  }
  return parsed;
}

function parsePositiveNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive number: ${value}`);
  }
  return parsed;
}

export async function main(argv = process.argv): Promise<void> {
  await createProgram().parseAsync(argv);
}

const isMainModule =
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[pf] ${message}`);
    process.exitCode = 1;
  });
}
