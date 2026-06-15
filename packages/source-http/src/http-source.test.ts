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
});
