import { DEFAULT_MOTION_STATE } from "@puppetflow/core";
import { describe, expect, it, vi, afterEach } from "vitest";
import { LoggerAdapter } from "./logger-adapter.js";

describe("LoggerAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throttles log output", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const adapter = new LoggerAdapter({ throttleMs: 1000 });

    await adapter.update({ ...DEFAULT_MOTION_STATE, mouthX: 0.4 }, 0.016);
    await adapter.update({ ...DEFAULT_MOTION_STATE, mouthX: 0.5 }, 0.016);

    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});
