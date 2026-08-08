import { describe, expect, it, vi } from "vitest";
import type { MotionFrame } from "@puppetflow/core";
import type { MotionSource } from "./motion-source.js";

describe("MotionSource", () => {
  it("allows a source to emit arbitrary canonical frames", async () => {
    const received: MotionFrame[] = [];
    const source: MotionSource = {
      id: "camera",
      async start(emit) {
        emit({
          timestamp: 12,
          bones: { UnknownBone: { rotation: { x: 0, y: 0, z: 0, w: 1 } } },
        });
      },
      async stop() {},
    };

    await source.start((frame) => received.push(frame));

    expect(received).toHaveLength(1);
    expect(received[0].bones?.UnknownBone.rotation?.w).toBe(1);
    vi.restoreAllMocks();
  });
});
