import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MotionFrame } from "@puppetflow/core";
import { ReplaySource } from "./replay-source.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true })),
  );
});

describe("ReplaySource", () => {
  it("applies speed and start offset without loading an array", async () => {
    const path = await createRecording([
      { timestamp: 0, parameters: { value: 0 } },
      { timestamp: 100, parameters: { value: 1 } },
      { timestamp: 200, parameters: { value: 2 } },
    ]);
    const received: MotionFrame[] = [];
    const source = new ReplaySource(path, { speed: 2, startOffsetMs: 50 });

    await source.start((frame) => received.push(frame));
    await waitFor(() => expect(received).toHaveLength(0), 10);
    await waitFor(() => expect(received[0]?.parameters?.value).toBe(1), 500);
    expect(received[0]?.parameters?.value).toBe(1);
    await waitFor(() => expect(received[1]?.parameters?.value).toBe(2), 500);
    expect(received[1]?.parameters?.value).toBe(2);

    await source.stop();
  });

  it("stops pending replay timers and supports looping", async () => {
    const path = await createRecording([
      { timestamp: 0, parameters: { value: 0 } },
      { timestamp: 40, parameters: { value: 1 } },
    ]);
    const received: MotionFrame[] = [];
    const source = new ReplaySource(path, { speed: 1, loop: true });

    await source.start((frame) => received.push(frame));
    await waitFor(() => expect(received[0]?.parameters?.value).toBe(0), 500);
    expect(received[0]?.parameters?.value).toBe(0);
    await waitFor(() => expect(received[1]?.parameters?.value).toBe(1), 500);
    expect(received[1]?.parameters?.value).toBe(1);

    await source.stop();
    const countAfterStop = received.length;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(received).toHaveLength(countAfterStop);
  });
});

async function createRecording(frames: MotionFrame[]): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "puppetflow-replay-"));
  temporaryDirectories.push(directory);
  const lines = [
    JSON.stringify({
      type: "header",
      format: "puppetflow-motion",
      version: 1,
      timeUnit: "ms",
      metadata: {},
    }),
    ...frames.map((frame) => JSON.stringify({ type: "frame", frame })),
  ];
  const path = join(directory, "session.pfmotion");
  await writeFile(path, `${lines.join("\n")}\n`, "utf8");
  return path;
}

async function waitFor(assertion: () => void, timeoutMs: number): Promise<void> {
  await vi.waitFor(assertion, { timeout: timeoutMs, interval: 5 });
}
