import { ChannelStore, StateStore, TimelineStore } from "@puppetflow/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocketSource } from "./websocket-source.js";

class MockWebSocket {
  static readonly instances: MockWebSocket[] = [];

  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
    queueMicrotask(() => this.onopen?.());
  }

  close(): void {}
}

describe("WebSocketSource", () => {
  beforeEach(() => {
    MockWebSocket.instances.length = 0;
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies state envelopes from websocket messages", async () => {
    const source = new WebSocketSource({ url: "ws://127.0.0.1:9000" });
    await source.initialize();

    const socket = MockWebSocket.instances[0];
    expect(socket?.url).toBe("ws://127.0.0.1:9000");

    socket?.onmessage?.({
      data: JSON.stringify({
        type: "state",
        state: { interest: 0.55 },
      }),
    });

    const target = {
      state: new StateStore(),
      channels: new ChannelStore(),
      timeline: new TimelineStore(),
    };

    await source.update(target);

    expect(target.state.get("interest")).toBe(0.55);
    await source.dispose();
  });

  it("ignores malformed websocket payloads", async () => {
    const source = new WebSocketSource({ url: "ws://127.0.0.1:9000" });
    await source.initialize();

    MockWebSocket.instances[0]?.onmessage?.({ data: "not-json" });

    const target = {
      state: new StateStore(),
      channels: new ChannelStore(),
      timeline: new TimelineStore(),
    };

    await source.update(target);

    expect(target.state.getAll()).toEqual({});
    await source.dispose();
  });
});
