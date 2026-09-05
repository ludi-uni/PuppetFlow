import { describe, expect, it, vi } from "vitest";
import { startFromEnvironment } from "./main.js";

describe("workspace MCP lifecycle", () => {
  it("closes only its stdio handle and Control client exactly once", async () => {
    const closeControl = vi.fn();
    const closeServer = vi.fn(async () => {});
    const running = await startFromEnvironment(
      {},
      {
        connectControl: async () => ({ close: closeControl }) as never,
        serve: () => ({ close: closeServer }),
      },
    );

    expect(running).toBeDefined();
    await running?.close();
    await running?.close();
    expect(closeServer).toHaveBeenCalledTimes(1);
    expect(closeControl).toHaveBeenCalledTimes(1);
  });

  it("releases a connected Control client when stdio setup fails", async () => {
    const closeControl = vi.fn();
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const previousExitCode = process.exitCode;
    try {
      const running = await startFromEnvironment(
        {},
        {
          connectControl: async () => ({ close: closeControl }) as never,
          serve: () => {
            throw new Error("stdio unavailable");
          },
        },
      );
      expect(running).toBeUndefined();
      expect(closeControl).toHaveBeenCalledTimes(1);
      expect(String(stderr.mock.calls[0]?.[0])).toContain(
        '"code":"runtime_unavailable"',
      );
    } finally {
      stderr.mockRestore();
      process.exitCode = previousExitCode;
    }
  });
});
