import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import {
  resolveSharedControlEnvironment,
  SharedHostMcpControl,
} from "./shared-control-client.js";

describe("shared Host MCP control client", () => {
  it("requires only the existing shared Host settings and validates timeout", () => {
    expect(
      resolveSharedControlEnvironment({
        PUPPETFLOW_SHARED_HOST_URL: "http://127.0.0.1:8788",
        PUPPETFLOW_SHARED_HOST_TOKEN: "test-token",
      }),
    ).toEqual({
      baseUrl: "http://127.0.0.1:8788",
      token: "test-token",
      timeoutMs: 5_000,
    });
    expect(() => resolveSharedControlEnvironment({})).toThrow(/required/);
    expect(() =>
      resolveSharedControlEnvironment({
        PUPPETFLOW_SHARED_HOST_URL: "http://127.0.0.1:8788",
        PUPPETFLOW_SHARED_HOST_TOKEN: "test-token",
        PUPPETFLOW_SHARED_HOST_TIMEOUT_MS: "0",
      }),
    ).toThrow(/positive/);
  });

  it("does not retry a timed-out command and preserves outcome-unknown", async () => {
    let commandRequests = 0;
    const server = createServer((request, response) => {
      const path = new URL(request.url ?? "/", "http://localhost").pathname;
      response.setHeader("content-type", "application/json");
      if (path === "/v1/connection") {
        response.end(
          JSON.stringify({ protocolVersion: 1, hostInstanceId: "host-a", ready: true }),
        );
      } else if (path === "/v1/capabilities") {
        response.end(
          JSON.stringify({
            acting: { actions: ["wave"], sequence: true, interrupt: true },
            expressions: { names: ["happy"], clear: true },
          }),
        );
      } else if (path === "/v1/state") {
        response.end(
          JSON.stringify({
            protocolVersion: 1,
            hostInstanceId: "host-a",
            sequence: 1,
            state: {
              acting: { elapsed: 0, remaining: 0, queuedActions: 0, blendRemaining: 0 },
              expression: { elapsed: 0, remaining: 0, fadeRemaining: 0 },
            },
          }),
        );
      } else {
        commandRequests++;
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const control = await SharedHostMcpControl.connect({
      baseUrl: `http://127.0.0.1:${port}`,
      token: "test-token",
      timeoutMs: 20,
    });

    try {
      await expect(control.act({ action: "wave" })).rejects.toMatchObject({
        outcomeUnknown: true,
      });
      expect(commandRequests).toBe(1);
    } finally {
      control.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
