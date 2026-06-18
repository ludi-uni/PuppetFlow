import { describe, expect, it } from "vitest";

import { getBehaviorDefinition } from "./registry.js";
import { applyKeyframeRandomization } from "./randomize.js";
import { sampleBehaviorAtTime } from "./executor.js";

describe("applyKeyframeRandomization", () => {
  it("keeps look_right below neutral when randomizing toward minimum magnitude", () => {
    const keyframes = applyKeyframeRandomization(
      getBehaviorDefinition("look_right"),
      () => 0,
    );

    const hold = keyframes.find((frame) => frame.t === 0.25);
    expect(hold?.params.lookX).toBeLessThan(0.5);
  });

  it("keeps look_left and look_right on opposite sides after randomization", () => {
    const leftFrames = applyKeyframeRandomization(
      getBehaviorDefinition("look_left"),
      () => 1,
    );
    const rightFrames = applyKeyframeRandomization(
      getBehaviorDefinition("look_right"),
      () => 1,
    );

    const left = sampleBehaviorAtTime(leftFrames, 0.5, 1);
    const right = sampleBehaviorAtTime(rightFrames, 0.5, 1);

    expect(left.motion.lookX).toBeGreaterThan(0.5);
    expect(right.motion.lookX).toBeLessThan(0.5);
    expect(left.motion.lookX).not.toBeCloseTo(right.motion.lookX!, 2);
  });
});
