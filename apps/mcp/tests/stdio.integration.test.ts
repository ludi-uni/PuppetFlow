import { createServer } from "node:net";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { getPresetJson } from "@puppetflow/behavior-packs";
import { PuppetFlowControlClient } from "@puppetflow/control-client";
import {
  createPuppetFlowHost,
  createSharedHostService,
  DEFAULT_ACTING_BONE_PROFILE,
  DEFAULT_EXPRESSION_PROFILE,
} from "@puppetflow/runtime-launcher/node";
import { describe, expect, it } from "vitest";

const TOOL_NAMES = [
  "act",
  "sequence",
  "look_at",
  "interrupt",
  "get_state",
  "set_expression",
  "clear_expression",
];
const REPOSITORY_ROOT = resolve(import.meta.dirname, "../../..");
const MCP_ENTRYPOINT = resolve(REPOSITORY_ROOT, "apps/mcp/dist/main.js");

describe("workspace MCP stdio entrypoint", () => {
  it("uses one external shared Host and leaves it running after MCP exit", async () => {
    const port = await freePort();
    const token = "workspace-mcp-test-token";
    let service = createService(port, token);
    await service.start();
    let observer = new PuppetFlowControlClient({ baseUrl: service.url, token });
    const first = await observer.connect();
    const stderr: Buffer[] = [];
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [MCP_ENTRYPOINT],
      cwd: REPOSITORY_ROOT,
      env: {
        PUPPETFLOW_SHARED_HOST_URL: service.url,
        PUPPETFLOW_SHARED_HOST_TOKEN: token,
        PUPPETFLOW_SHARED_HOST_TIMEOUT_MS: "1000",
      },
      stderr: "pipe",
    });
    transport.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
    const client = new Client({ name: "workspace-mcp-test", version: "1.0.0" });

    try {
      try {
        await client.connect(transport);
      } catch (error) {
        throw new Error(`MCP stdio failed: ${Buffer.concat(stderr).toString("utf8")}`, {
          cause: error,
        });
      }
      expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(
        TOOL_NAMES,
      );
      expect(
        accepted(await call(client, "act", { action: "wave", intensity: 0.7 })),
      ).toBe(true);
      expect((await observer.getSnapshot()).state.acting.activeAction?.action).toBe(
        "wave",
      );
      expect(
        accepted(
          await call(client, "sequence", {
            actions: [{ action: "head_tilt", duration: 0.4 }],
          }),
        ),
      ).toBe(true);
      expect(accepted(await call(client, "look_at", { target: "right" }))).toBe(true);
      expect(
        accepted(
          await call(client, "set_expression", {
            expression: "happy",
            intensity: 0.7,
            fadeIn: 0,
          }),
        ),
      ).toBe(true);
      const state = structured(await call(client, "get_state", {}));
      expect(
        (state.expression as { current_expression?: string }).current_expression,
      ).toBe("happy");
      expect(
        (await observer.getSnapshot()).state.expression.activeExpression?.expression,
      ).toBe("happy");
      expect(accepted(await call(client, "clear_expression", { fadeOut: 0 }))).toBe(
        true,
      );
      expect(accepted(await call(client, "interrupt", {}))).toBe(true);
      const rejected = await call(client, "act", { action: "not_available" });
      expect(rejected.isError).toBe(true);
      expect((structured(rejected).error as { code?: string }).code).toBe(
        "command_rejected",
      );

      const capabilities = await observer.getCapabilities();
      expect(capabilities.acting.actions).toContain("wave");
      expect(capabilities.expressions.names).toContain("happy");

      await service.close();
      observer.close();
      service = createService(port, token);
      await service.start();
      let restartedState = await call(client, "get_state", {});
      if (restartedState.isError) restartedState = await call(client, "get_state", {});
      expect(restartedState.isError).toBeUndefined();
      expect(structured(restartedState).current_action).toBeNull();

      observer = new PuppetFlowControlClient({ baseUrl: service.url, token });
      const replacement = await observer.connect();
      expect(replacement.info.hostInstanceId).not.toBe(first.info.hostInstanceId);
      expect(replacement.snapshot.state.acting.activeAction).toBeUndefined();
      expect(replacement.snapshot.state.expression.activeExpression).toBeUndefined();
      await client.close();
      expect((await observer.getSnapshot()).protocolVersion).toBe(1);
    } finally {
      await client.close().catch(() => undefined);
      observer.close();
      await service.close();
    }

    expect(Buffer.concat(stderr).toString("utf8")).toBe("");
  });

  it("fails startup with an invalid token without stopping or exposing the Host", async () => {
    const port = await freePort();
    const service = createService(port, "correct-test-token");
    await service.start();
    const observer = new PuppetFlowControlClient({
      baseUrl: service.url,
      token: "correct-test-token",
    });
    await observer.connect();
    const stderr: Buffer[] = [];
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [MCP_ENTRYPOINT],
      cwd: REPOSITORY_ROOT,
      env: {
        PUPPETFLOW_SHARED_HOST_URL: service.url,
        PUPPETFLOW_SHARED_HOST_TOKEN: "wrong-test-token",
      },
      stderr: "pipe",
    });
    transport.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
    const client = new Client({ name: "invalid-token-test", version: "1.0.0" });

    try {
      await expect(client.connect(transport)).rejects.toThrow();
      expect((await observer.getSnapshot()).protocolVersion).toBe(1);
      const diagnostic = Buffer.concat(stderr).toString("utf8");
      expect(diagnostic).toContain('"code":"runtime_unavailable"');
      expect(diagnostic).not.toContain("wrong-test-token");
    } finally {
      await client.close().catch(() => undefined);
      observer.close();
      await service.close();
    }
  });
});

function createService(port: number, token: string) {
  const host = createPuppetFlowHost({
    presetJson: getPresetJson("Idle"),
    acting: {
      profile: DEFAULT_ACTING_BONE_PROFILE,
      expressionProfile: DEFAULT_EXPRESSION_PROFILE,
      autoIdle: false,
    },
    vmc: false,
  });
  return createSharedHostService({ host, token, port });
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveReady) =>
    server.listen(0, "127.0.0.1", resolveReady),
  );
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolveClosed) => server.close(() => resolveClosed()));
  return port;
}

function call(client: Client, name: string, arguments_: Record<string, unknown>) {
  return client.callTool({ name, arguments: arguments_ });
}

function structured(result: { structuredContent?: unknown }): Record<string, unknown> {
  expect(result.structuredContent).toBeTruthy();
  return result.structuredContent as Record<string, unknown>;
}

function accepted(result: { structuredContent?: unknown }): boolean {
  return structured(result).accepted === true;
}
