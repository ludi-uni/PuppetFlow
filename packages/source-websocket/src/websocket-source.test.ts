import { ChannelStore, StateStore, TimelineStore } from "@puppetflow/core";
import { MotionOverrideStore } from "@puppetflow/source-core";
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
      motion: new MotionOverrideStore(),
    };

    await source.update(target);

    expect(target.state.get("interest")).toBe(0.55);
    await source.dispose();
  });

  it("forwards behavior envelopes to the source target", async () => {
    const source = new WebSocketSource({ url: "ws://127.0.0.1:9000" });
    await source.initialize();

    MockWebSocket.instances[0]?.onmessage?.({
      data: JSON.stringify({
        type: "behavior",
        behavior: "look_up",
      }),
    });

    const target = {
      state: new StateStore(),
      channels: new ChannelStore(),
      timeline: new TimelineStore(),
      motion: new MotionOverrideStore(),
    };
    let behaviorPayload: Record<string, unknown> | null = null;

    await source.update({
      ...target,
      microBehavior: {
        applyFromInputRecord(record) {
          behaviorPayload = record;
        },
      },
    });

    expect(behaviorPayload).toEqual({ type: "behavior", behavior: "look_up" });
    await source.dispose();
  });

  it("returns only the latest buffered websocket payload when polled", async () => {
    const source = new WebSocketSource({
      url: "ws://127.0.0.1:9000",
      fieldMapping: { interest: "mood" },
    });
    await source.initialize();

    MockWebSocket.instances[0]?.onmessage?.({
      data: JSON.stringify({ interest: 0.2 }),
    });
    MockWebSocket.instances[0]?.onmessage?.({
      data: JSON.stringify({ interest: 0.8 }),
    });

    const update = await source.poll(new AbortController().signal);

    expect(source.pollIntervalMs).toBe(16);
    expect(update).toEqual({
      payload: { interest: 0.8 },
      fieldMapping: { interest: "mood" },
    });
    await expect(source.poll(new AbortController().signal)).resolves.toBeUndefined();
    await source.dispose();
  });

  it("applies a polled websocket payload through its field mapping", async () => {
    const source = new WebSocketSource({
      url: "ws://127.0.0.1:9000",
      fieldMapping: { interest: "mood" },
    });
    await source.initialize();
    MockWebSocket.instances[0]?.onmessage?.({
      data: JSON.stringify({ interest: 0.55 }),
    });
    const update = await source.poll(new AbortController().signal);
    const target = {
      state: new StateStore(),
      channels: new ChannelStore(),
      timeline: new TimelineStore(),
      motion: new MotionOverrideStore(),
    };

    expect(target.state.get("mood")).toBeUndefined();
    expect(update).toBeDefined();
    source.apply(update!, target);

    expect(target.state.get("mood")).toBe(0.55);
    await source.dispose();
  });

  it("does not publish a buffered websocket payload to an aborted poll", async () => {
    const source = new WebSocketSource({ url: "ws://127.0.0.1:9000" });
    await source.initialize();
    MockWebSocket.instances[0]?.onmessage?.({
      data: JSON.stringify({ interest: 0.55 }),
    });
    const controller = new AbortController();
    controller.abort();

    await expect(source.poll(controller.signal)).resolves.toBeUndefined();
    await source.dispose();
  });

  it("ignores malformed websocket payloads", async () => {
    const source = new WebSocketSource({ url: "ws://127.0.0.1:9000" });
    await source.initialize();

    MockWebSocket.instances[0]?.onmessage?.({ data: "not-json" });

    await expect(source.poll(new AbortController().signal)).resolves.toBeUndefined();
    await source.dispose();
  });
});
