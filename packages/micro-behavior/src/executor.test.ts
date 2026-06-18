import { describe, expect, it } from "vitest";

import { getBehaviorDefinition } from "./registry.js";
import { sampleBehaviorAtTime } from "./executor.js";

describe("sampleBehaviorAtTime", () => {
  it("look_up peaks lookY above neutral", () => {
    const keyframes = getBehaviorDefinition("look_up").keyframes;
    const hold = sampleBehaviorAtTime(keyframes, 0.5, 1);
    expect(hold.motion.lookY).toBeGreaterThan(0.5);
    expect(hold.activeKeys).toContain("lookY");
  });

  it("long_blink fully closes eyes at hold", () => {
    const keyframes = getBehaviorDefinition("long_blink").keyframes;
    const closed = sampleBehaviorAtTime(keyframes, 0.2, 1);
    expect(closed.motion.eyeYaw).toBe(0);
  });

  it("long_blink overshoots eyeYaw above 1.0 when reopening", () => {
    const keyframes = getBehaviorDefinition("long_blink").keyframes;
    const overshoot = sampleBehaviorAtTime(keyframes, 0.4, 1);
    expect(overshoot.motion.eyeYaw).toBeGreaterThan(1);
  });

  it("look_left and look_right move lookX to opposite sides", () => {
    const left = sampleBehaviorAtTime(
      getBehaviorDefinition("look_left").keyframes,
      0.5,
      1,
    );
    const right = sampleBehaviorAtTime(
      getBehaviorDefinition("look_right").keyframes,
      0.5,
      1,
    );

    expect(left.motion.lookX).toBeGreaterThan(0.5);
    expect(right.motion.lookX).toBeLessThan(0.5);
    expect(left.motion.lookX! - right.motion.lookX!).toBeGreaterThan(0.4);
  });

  it("head_tilt tilts head and face together", () => {
    const hold = sampleBehaviorAtTime(
      getBehaviorDefinition("head_tilt").keyframes,
      0.6,
      1,
    );

    expect(hold.motion.headTilt).toBeGreaterThan(0.5);
    expect(hold.motion.faceYaw).toBeGreaterThan(0.5);
    expect(hold.activeKeys).toContain("headTilt");
    expect(hold.activeKeys).toContain("faceYaw");
  });

  it("carries forward params omitted from later keyframes", () => {
    const keyframes = [
      { t: 0, params: { headTilt: 0, faceYaw: 0 } },
      { t: 0.3, params: { headTilt: 0.15, faceYaw: 0.08 } },
      { t: 1.0, params: { headTilt: 0.15 } },
      { t: 1.5, params: { headTilt: 0, faceYaw: 0 } },
    ];

    const hold = sampleBehaviorAtTime(keyframes, 0.6, 1);

    expect(hold.motion.headTilt).toBeGreaterThan(0.5);
    expect(hold.motion.faceYaw).toBeGreaterThan(0.5);
  });
});
