import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { MotionFrame } from "@puppetflow/core";
import { MotionFrameRecorder, readMotionRecording } from "./motion-recording.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("MotionFrameRecorder", () => {
  it("records and streams frames while preserving timestamps and metadata", async () => {
    const directory = await mkdtemp(join(tmpdir(), "puppetflow-motion-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "session.pfmotion");
    const recorder = new MotionFrameRecorder(path, { metadata: { test: true } });

    await recorder.start();
    await recorder.record({
      timestamp: 0,
      metadata: { sourceId: "replay" },
      bones: { Head: {} },
    });
    await recorder.record({ timestamp: 16, parameters: { mouthX: 0.4 } });
    await recorder.stop();

    const lines = (await readFile(path, "utf8")).trim().split("\n");
    expect(JSON.parse(lines[0]).metadata).toEqual({ test: true });

    const frames: MotionFrame[] = [];
    for await (const frame of readMotionRecording(path)) {
      frames.push(frame);
    }
    expect(frames).toEqual([
      expect.objectContaining({ timestamp: 0, metadata: { sourceId: "replay" } }),
      expect.objectContaining({ timestamp: 16, parameters: { mouthX: 0.4 } }),
    ]);
  });

  it("rejects malformed headers and malformed frame records", async () => {
    const directory = await mkdtemp(join(tmpdir(), "puppetflow-motion-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "broken.pfmotion");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path, '{"type":"header","format":"wrong","version":1}\n');

    await expect(collect(readMotionRecording(path))).rejects.toThrow();
  });
});

async function collect(iterable: AsyncIterable<MotionFrame>): Promise<MotionFrame[]> {
  const frames: MotionFrame[] = [];
  for await (const frame of iterable) {
    frames.push(frame);
  }
  return frames;
}
