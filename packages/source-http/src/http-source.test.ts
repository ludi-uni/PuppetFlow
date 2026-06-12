import { ChannelStore, StateStore, TimelineStore } from "@puppetflow/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpSource } from "./http-source.js";

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

    const target = {
      state: new StateStore(),
      channels: new ChannelStore(),
      timeline: new TimelineStore(),
    };

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

    const target = {
      state: new StateStore(),
      channels: new ChannelStore(),
      timeline: new TimelineStore(),
    };

    await source.update(target);
    await source.update(target);

    expect(fetch).toHaveBeenCalledTimes(1);
    await source.dispose();
  });

  it("throws when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    } as Response);

    const source = new HttpSource({ url: "http://example.com/state", intervalMs: 0 });
    await source.initialize();

    const target = {
      state: new StateStore(),
      channels: new ChannelStore(),
      timeline: new TimelineStore(),
    };

    await expect(source.update(target)).rejects.toThrow(/503/i);
    await source.dispose();
  });
});
