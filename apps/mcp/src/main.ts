#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serveStdio, type StdioServerHandle } from "@modelcontextprotocol/server/stdio";
import type { McpControlClient } from "./control.js";
import { buildServer } from "./server.js";
import {
  resolveSharedControlEnvironment,
  SharedHostMcpControl,
} from "./shared-control-client.js";

const STARTUP_ERROR = {
  error: {
    code: "runtime_unavailable",
    message: "Shared PuppetFlow Host is unavailable.",
  },
} as const;

export interface MainDependencies {
  connectControl: (environment: NodeJS.ProcessEnv) => Promise<McpControlClient>;
  serve: (control: McpControlClient) => StdioServerHandle;
}

const defaultDependencies: MainDependencies = {
  connectControl: async (environment) => {
    const options = resolveSharedControlEnvironment(environment);
    return SharedHostMcpControl.connect(options);
  },
  serve: (control) => serveStdio(() => buildServer(control)),
};

export async function startFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  dependencies: MainDependencies = defaultDependencies,
): Promise<{ close(): Promise<void> } | undefined> {
  let control: McpControlClient | undefined;
  try {
    control = await dependencies.connectControl(environment);
    const connectedControl = control;
    const server = dependencies.serve(connectedControl);
    let closed = false;
    return {
      async close(): Promise<void> {
        if (closed) return;
        closed = true;
        try {
          await server.close();
        } finally {
          connectedControl.close();
        }
      },
    };
  } catch {
    try {
      control?.close();
    } catch {
      // Startup diagnostics and fail-closed exit must remain stable.
    }
    process.stderr.write(`${JSON.stringify(STARTUP_ERROR)}\n`);
    process.exitCode = 1;
    return undefined;
  }
}

async function main(): Promise<void> {
  const running = await startFromEnvironment();
  if (!running) return;
  const close = () => void running.close();
  process.stdin.once("end", close);
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  process.once("SIGBREAK" as NodeJS.Signals, close);
}

const isMainModule =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) void main();
