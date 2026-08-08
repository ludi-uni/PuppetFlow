import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MOTION_STATE, type MotionFrame } from "@puppetflow/core";
import { MotionStateFrameSource } from "./motion-state-frame-source.js";

describe("MotionStateFrameSource", () => {
  it("emits MotionState parameters on its configured interval", async () => {
    vi.useFakeTimers();
    const received: MotionFrame[] = [];
    const source = new MotionStateFrameSource(
      () => ({ ...DEFAULT_MOTION_STATE, mouthX: 0.7 }),
      { intervalMs: 16 },
    );

    await source.start((frame) => received.push(frame));
    await vi.advanceTimersByTimeAsync(34);

    expect(received.length).toBeGreaterThanOrEqual(2);
    expect(received[0].parameters?.mouthX).toBe(0.7);
    expect(received[0].metadata?.sourceType).toBe("motion-state");
    expect(received[0].metadata?.clock).toBe("relative");
    expect(received[1].timestamp).toBeGreaterThanOrEqual(received[0].timestamp);

    const countBeforeStop = received.length;
    await source.stop();
    await vi.advanceTimersByTimeAsync(100);
    expect(received).toHaveLength(countBeforeStop);
    vi.useRealTimers();
  });

  it("serializes custom MotionState parameters without mutating the source state", async () => {
    const state = { ...DEFAULT_MOTION_STATE, custom: { blush: 0.25 } };
    const source = new MotionStateFrameSource(() => state, { now: () => 1000 });
    let received: MotionFrame | undefined;

    await source.start((frame) => {
      received = frame;
    });
    await source.stop();

    expect(received?.parameters?.blush).toBe(0.25);
    expect(received?.parameters).not.toBe(state.custom);
    expect(state.custom.blush).toBe(0.25);
  });
});
