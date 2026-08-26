import { ChannelStore, StateStore, TimelineStore } from "@puppetflow/core";
import { MotionOverrideStore } from "@puppetflow/source-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MqttSource } from "./mqtt-source.js";

type MqttHandler = (...args: unknown[]) => void;

function createMockMqttClient() {
  const handlers = new Map<string, MqttHandler[]>();

  return {
    on(event: string, handler: MqttHandler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    subscribe(_topic: string, callback: (error: Error | null) => void) {
      callback(null);
    },
    end(_force: boolean, _options: Record<string, never>, callback: () => void) {
      callback();
    },
    emit(event: string, ...args: unknown[]) {
      for (const handler of handlers.get(event) ?? []) {
        handler(...args);
      }
    },
  };
}

let mockClient = createMockMqttClient();

vi.mock("mqtt", () => ({
  default: {
    connect: vi.fn(() => {
      mockClient = createMockMqttClient();
      queueMicrotask(() => mockClient.emit("connect"));
      return mockClient;
    }),
  },
}));

describe("MqttSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockClient = createMockMqttClient();
  });

  it("applies JSON payloads received on the subscribed topic", async () => {
    const source = new MqttSource({
      brokerUrl: "mqtt://127.0.0.1:1883",
      topic: "puppetflow/state",
    });

    await source.initialize();

    mockClient.emit(
      "message",
      "puppetflow/state",
      Buffer.from(JSON.stringify({ energy: 0.6 })),
    );

    const target = {
      state: new StateStore(),
      channels: new ChannelStore(),
      timeline: new TimelineStore(),
      motion: new MotionOverrideStore(),
    };

    await source.update(target);

    expect(target.state.get("energy")).toBe(0.6);
    await source.dispose();
  });

  it("returns only the latest buffered mqtt payload when polled", async () => {
    const source = new MqttSource({
      brokerUrl: "mqtt://127.0.0.1:1883",
      topic: "puppetflow/state",
      fieldMapping: { energy: "mood" },
    });
    await source.initialize();
    mockClient.emit(
      "message",
      "puppetflow/state",
      Buffer.from(JSON.stringify({ energy: 0.2 })),
    );
    mockClient.emit(
      "message",
      "puppetflow/state",
      Buffer.from(JSON.stringify({ energy: 0.8 })),
    );

    const update = await source.poll(new AbortController().signal);

    expect(source.pollIntervalMs).toBe(16);
    expect(update).toEqual({
      payload: { energy: 0.8 },
      fieldMapping: { energy: "mood" },
    });
    await expect(source.poll(new AbortController().signal)).resolves.toBeUndefined();
    await source.dispose();
  });

  it("applies a polled mqtt payload through its field mapping", async () => {
    const source = new MqttSource({
      brokerUrl: "mqtt://127.0.0.1:1883",
      topic: "puppetflow/state",
      fieldMapping: { energy: "mood" },
    });
    await source.initialize();
    mockClient.emit(
      "message",
      "puppetflow/state",
      Buffer.from(JSON.stringify({ energy: 0.6 })),
    );
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

    expect(target.state.get("mood")).toBe(0.6);
    await source.dispose();
  });

  it("does not publish a buffered mqtt payload to an aborted poll", async () => {
    const source = new MqttSource({
      brokerUrl: "mqtt://127.0.0.1:1883",
      topic: "puppetflow/state",
    });
    await source.initialize();
    mockClient.emit(
      "message",
      "puppetflow/state",
      Buffer.from(JSON.stringify({ energy: 0.6 })),
    );
    const controller = new AbortController();
    controller.abort();

    await expect(source.poll(controller.signal)).resolves.toBeUndefined();
    await source.dispose();
  });

  it("ignores malformed mqtt payloads", async () => {
    const source = new MqttSource({
      brokerUrl: "mqtt://127.0.0.1:1883",
      topic: "puppetflow/state",
    });

    await source.initialize();

    mockClient.emit("message", "puppetflow/state", Buffer.from("not-json"));

    await expect(source.poll(new AbortController().signal)).resolves.toBeUndefined();
    await source.dispose();
  });
});
