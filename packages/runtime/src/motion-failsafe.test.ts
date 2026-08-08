import { describe, expect, it } from "vitest";

import { applyMotionFailSafe } from "./motion-failsafe.js";

const frame = {
  timestamp: 10,
  sequence: 2,
  bones: {
    Hips: {
      position: { x: 2, y: -2, z: 1 },
      rotation: { x: 0, y: 0, z: 1, w: 0 },
      scale: { x: 2, y: 1, z: 0.5 },
      confidence: 0.8,
    },
    Head: {
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    },
    Unknown: {},
  },
  blendShapes: { Smile: 1 },
  parameters: { lean: -0.5 },
  metadata: { sourceId: "source" },
};

describe("applyMotionFailSafe", () => {
  it("keeps a fresh frame active", () => {
    const result = applyMotionFailSafe(frame, 99, {
      timeoutMs: 100,
      action: "disable-source",
    });

    expect(result).toEqual({ stale: false, frame });
  });

  it("holds the latest frame when a source is stale", () => {
    const result = applyMotionFailSafe(frame, 101, {
      timeoutMs: 100,
      action: "hold-last-frame",
    });

    expect(result).toEqual({ stale: true, frame });
    expect(result.frame).not.toBe(frame);
  });

  it("disables a stale source", () => {
    expect(
      applyMotionFailSafe(frame, 101, {
        timeoutMs: 100,
        action: "disable-source",
      }),
    ).toEqual({ stale: true, frame: undefined });
  });

  it("blends existing components toward neutral targets", () => {
    const halfway = applyMotionFailSafe(frame, 150, {
      timeoutMs: 100,
      action: "blend-to-neutral",
      transitionMs: 100,
    });
    const neutral = applyMotionFailSafe(frame, 200, {
      timeoutMs: 100,
      action: "blend-to-neutral",
      transitionMs: 100,
    });

    expect(halfway.stale).toBe(true);
    expect(halfway.frame?.parameters?.lean).toBeCloseTo(-0.25);
    expect(halfway.frame?.blendShapes?.Smile).toBeCloseTo(0.5);
    expect(halfway.frame?.bones?.Hips?.position).toEqual({ x: 1, y: -1, z: 0.5 });
    expect(halfway.frame?.bones?.Hips?.scale).toEqual({ x: 1.5, y: 1, z: 0.75 });
    expect(halfway.frame?.bones?.Head?.position).toBeUndefined();
    expect(halfway.frame?.bones?.Unknown).toEqual({});
    expect(halfway.frame?.bones?.Hips?.rotation?.w).toBeGreaterThan(0);
    expect(neutral.frame?.parameters?.lean).toBe(0);
    expect(neutral.frame?.bones?.Hips?.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(neutral.frame?.bones?.Hips?.scale).toEqual({ x: 1, y: 1, z: 1 });
    expect(neutral.frame?.bones?.Hips?.rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    expect(neutral.frame?.timestamp).toBe(frame.timestamp);
    expect(neutral.frame?.metadata).toEqual(frame.metadata);
  });

  it("rejects invalid fail-safe configuration and age", () => {
    expect(() =>
      applyMotionFailSafe(frame, -1, {
        timeoutMs: 100,
        action: "hold-last-frame",
      }),
    ).toThrow("ageMs");
    expect(() =>
      applyMotionFailSafe(frame, 1, {
        timeoutMs: -1,
        action: "hold-last-frame",
      }),
    ).toThrow("timeoutMs");
    expect(() =>
      applyMotionFailSafe(frame, 1, {
        timeoutMs: 100,
        action: "blend-to-neutral",
        transitionMs: -1,
      }),
    ).toThrow("transitionMs");
  });
});
