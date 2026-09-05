import { describe, expect, it, vi } from "vitest";
import { PuppetFlowControlClient, PuppetFlowControlTransportError } from "./index.js";

const state = {
  acting: { elapsed: 0, remaining: 0, queuedActions: 0, blendRemaining: 0 },
  expression: { elapsed: 0, remaining: 0, fadeRemaining: 0 },
};

describe("PuppetFlowControlClient", () => {
  it("connects with canonical snapshots and serializes commands with the verified Host instance", async () => {
    const calls: RequestInit[] = [];
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      calls.push(init!);
      const path = _url.split("/").pop();
      const value =
        path === "connection"
          ? { protocolVersion: 1, hostInstanceId: "host-a", ready: true }
          : path === "capabilities"
            ? {
                acting: { actions: ["wave"], sequence: true, interrupt: true },
                expressions: { names: ["happy"], clear: true },
              }
            : path === "state"
              ? {
                  protocolVersion: 1,
                  hostInstanceId: "host-a",
                  sequence: 1,
                  state,
                }
              : { accepted: true, state };
      return new Response(JSON.stringify(value), { status: 200 });
    });
    const client = new PuppetFlowControlClient({
      baseUrl: "http://127.0.0.1:8788",
      token: "secret",
      fetch,
    });
    await client.connect();
    await Promise.all([client.act({ action: "wave" }), client.interrupt()]);
    expect(calls.slice(-2).map((call) => call.headers)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ "X-PuppetFlow-Host-Instance": "host-a" }),
      ]),
    );
  });

  it("marks command transport failures as outcome unknown and does not retry", async () => {
    let connected = false;
    const fetch = vi.fn(async (url: string) => {
      if (!connected && url.endsWith("/v1/connection")) {
        connected = true;
        return new Response(
          JSON.stringify({ protocolVersion: 1, hostInstanceId: "host-a", ready: true }),
        );
      }
      if (url.endsWith("/v1/capabilities")) {
        return new Response(
          JSON.stringify({
            acting: { actions: [], sequence: true, interrupt: true },
            expressions: { names: [], clear: false },
          }),
        );
      }
      if (url.endsWith("/v1/state")) {
        return new Response(
          JSON.stringify({
            protocolVersion: 1,
            hostInstanceId: "host-a",
            sequence: 1,
            state,
          }),
        );
      }
      throw new Error("offline");
    });
    const client = new PuppetFlowControlClient({
      baseUrl: "http://127.0.0.1:8788",
      token: "secret",
      fetch,
    });
    await client.connect();
    const beforeCommand = fetch.mock.calls.length;
    const first = client.act({ action: "wave" });
    const queued = client.act({ action: "nod" });
    await expect(first).rejects.toMatchObject<PuppetFlowControlTransportError>({
      outcomeUnknown: true,
    });
    await expect(queued).rejects.toMatchObject<PuppetFlowControlTransportError>({
      outcomeUnknown: false,
    });
    expect(fetch).toHaveBeenCalledTimes(beforeCommand + 1);
  });

  it("does not continue a delayed connection after close", async () => {
    let resolveConnection: ((response: Response) => void) | undefined;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveConnection = resolve;
        }),
    );
    const client = new PuppetFlowControlClient({
      baseUrl: "http://127.0.0.1:8788",
      token: "secret",
      fetch,
    });
    const connecting = client.connect();
    client.close();
    resolveConnection?.(
      new Response(
        JSON.stringify({ protocolVersion: 1, hostInstanceId: "host-a", ready: true }),
      ),
    );

    await expect(connecting).rejects.toThrow(/closed/i);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
