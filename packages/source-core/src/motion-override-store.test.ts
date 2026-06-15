import { createEmptyMotionState } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import { MotionOverrideStore } from "./motion-override-store.js";

describe("MotionOverrideStore", () => {
  it("applies standard and custom motion keys", () => {
    const store = new MotionOverrideStore();
    store.applyPayload({
      mouthX: 0.8,
      lookX: 0.2,
      custom: { heartbeat: 0.5 },
    });

    const base = createEmptyMotionState();
    base.mouthX = 0.1;
    base.lookX = 0.5;

    const result = store.applyTo(base);
    expect(result.mouthX).toBe(0.8);
    expect(result.lookX).toBe(0.2);
    expect(result.custom.heartbeat).toBe(0.5);
  });

  it("migrates legacy motion keys", () => {
    const store = new MotionOverrideStore();
    store.applyPayload({ faceRoll: 0.7 });

    const result = store.applyTo(createEmptyMotionState());
    expect(result.headTilt).toBe(0.7);
  });

  it("clamps values to 0..1", () => {
    const store = new MotionOverrideStore();
    store.applyPayload({ mouthY: 1.5, eyeYaw: -0.2 });

    const result = store.applyTo(createEmptyMotionState());
    expect(result.mouthY).toBe(1);
    expect(result.eyeYaw).toBe(0);
  });
});
