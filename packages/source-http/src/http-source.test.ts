import { ChannelStore, StateStore, TimelineStore } from "@puppetflow/core";
import { MotionOverrideStore } from "@puppetflow/source-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpSource } from "./http-source.js";

function createTarget() {
  return {
    state: new StateStore(),
    channels: new ChannelStore(),
    timeline: new TimelineStore(),
    motion: new MotionOverrideStore(),
  };
}

describe("HttpSource", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches JSON and applies it to the runtime target", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ interest: 0.7 }),
    } as Response);

    const source = new HttpSource({ url: "http://example.com/state", intervalMs: 0 });
    await source.initialize();

    const target = createTarget();

    await source.update(target);

    expect(fetch).toHaveBeenCalledWith("http://example.com/state", {
      signal: expect.any(AbortSignal),
    });
    expect(target.state.get("interest")).toBe(0.7);
    await source.dispose();
  });

  it("polls JSON without mutating a runtime target", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ interest: 0.7 }),
    } as Response);

    const source = new HttpSource({
      url: "http://example.com/state",
      intervalMs: 250,
      fieldMapping: { interest: "mood" },
    });
    const target = createTarget();

    const update = await source.poll(new AbortController().signal);

    expect(source.pollIntervalMs).toBe(250);
    expect(update).toEqual({
      payload: { interest: 0.7 },
      fieldMapping: { interest: "mood" },
    });
    expect(target.state.get("interest")).toBeUndefined();
    await source.dispose();
  });

  it("uses a one-second polling interval by default", () => {
    const source = new HttpSource({ url: "http://example.com/state" });

    expect(source.pollIntervalMs).toBe(1000);
  });

  it("applies a polled payload through its field mapping", () => {
    const source = new HttpSource({
      url: "http://example.com/state",
      fieldMapping: { interest: "mood" },
    });
    const target = createTarget();

    source.apply(
      { payload: { interest: 0.7 }, fieldMapping: { interest: "mood" } },
      target,
    );

    expect(target.state.get("mood")).toBe(0.7);
  });

  it("resolves an aborted poll without publishing an update", async () => {
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    const source = new HttpSource({ url: "http://example.com/state" });
    const controller = new AbortController();

    const pending = source.poll(controller.signal);
    controller.abort();

    await expect(pending).resolves.toBeUndefined();
    await source.dispose();
  });

  it("aborts an in-flight poll on dispose", async () => {
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    const source = new HttpSource({ url: "http://example.com/state" });

    const pending = source.poll(new AbortController().signal);
    await source.dispose();

    await expect(pending).resolves.toBeUndefined();
  });

  it("respects polling interval", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ energy: 1 }),
    } as Response);

    const source = new HttpSource({
      url: "http://example.com/state",
      intervalMs: 60_000,
    });
    await source.initialize();

    const target = createTarget();

    await source.update(target);
    await source.update(target);

    expect(fetch).toHaveBeenCalledTimes(1);
    await source.dispose();
  });

  it("aborts in-flight fetch on dispose", async () => {
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const source = new HttpSource({ url: "http://example.com/state", intervalMs: 0 });
    const target = createTarget();

    const pending = source.update(target);
    await source.dispose();
    await expect(pending).resolves.toBeUndefined();
  });

  it("throws when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    } as Response);

    const source = new HttpSource({ url: "http://example.com/state", intervalMs: 0 });
    await source.initialize();

    const target = createTarget();

    await expect(source.update(target)).rejects.toThrow(/503/i);
    await source.dispose();
  });

  it("rejects a poll when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    } as Response);

    const source = new HttpSource({ url: "http://example.com/state" });

    await expect(source.poll(new AbortController().signal)).rejects.toThrow(/503/i);
    await source.dispose();
  });
});
