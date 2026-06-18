import { describe, expect, it } from "vitest";

import { MicroBehaviorEngine } from "./engine.js";

describe("MicroBehaviorEngine", () => {
  it("executes behaviors serially through the queue", () => {
    const engine = new MicroBehaviorEngine({ random: () => 0.5 });
    expect(engine.request({ behavior: "look_up" })).toBe(true);
    expect(engine.request({ behavior: "small_nod" })).toBe(true);
    expect(engine.getQueueStatus().queueLength).toBe(1);

    engine.tick(1.5);
    expect(engine.getStatus().activeBehavior).toBe("small_nod");
  });

  it("ignores requests during cooldown", () => {
    const engine = new MicroBehaviorEngine({ random: () => 0.5 });
    expect(engine.request({ behavior: "look_up" })).toBe(true);
    engine.tick(0.1);
    expect(engine.request({ behavior: "look_up" })).toBe(false);
  });

  it("replaces custom definitions via setCustomDefinitions", () => {
    const engine = new MicroBehaviorEngine({ random: () => 0.5 });
    engine.setCustomDefinitions([
      {
        id: "wave_a",
        duration: 0.5,
        cooldown: 0,
        keyframes: [{ t: 0, params: { lookX: 0.5 } }],
      },
    ]);
    expect(engine.hasBehavior("wave_a")).toBe(true);

    engine.setCustomDefinitions([
      {
        id: "wave_b",
        duration: 0.5,
        cooldown: 0,
        keyframes: [{ t: 0, params: { lookY: 0.5 } }],
      },
    ]);
    expect(engine.hasBehavior("wave_a")).toBe(false);
    expect(engine.hasBehavior("wave_b")).toBe(true);
  });

  it("randomizes peak amplitude when random varies", () => {
    let step = 0;
    const engineA = new MicroBehaviorEngine({
      random: () => (step++ % 2 === 0 ? 0 : 1),
    });
    const engineB = new MicroBehaviorEngine({ random: () => 0.5 });

    engineA.request({ behavior: "look_up" });
    engineB.request({ behavior: "look_up" });

    const sampleA = engineA.tick(0.5)?.motion.lookY;
    const sampleB = engineB.tick(0.5)?.motion.lookY;

    expect(sampleA).toBeDefined();
    expect(sampleB).toBeDefined();
    expect(sampleA).not.toBe(sampleB);
  });
});
