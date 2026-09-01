import { describe, expect, it } from "vitest";

import { sampleActingPrimitive } from "./primitives.js";
import { blendBoneRotations, identityPose } from "./rotation.js";
import { ActingScheduler } from "./scheduler.js";

const BONE_NAMES = ["Spine", "Head", "RightUpperArm", "RightLowerArm"] as const;

describe("ActingScheduler", () => {
  it("starts continuous idle when configured", () => {
    const scheduler = new ActingScheduler(BONE_NAMES, { autoIdle: true });

    expect(scheduler.get_state().activeAction).toEqual({ action: "idle" });
  });

  it("accepts commands immediately without waiting for their duration", () => {
    const scheduler = new ActingScheduler(BONE_NAMES);

    const result = scheduler.act("wave", { duration: 2 });

    expect(result.accepted).toBe(true);
    expect(result.state.activeAction?.action).toBe("wave");
    expect(result.state.remaining).toBe(2);
  });

  it("rejects invalid commands without changing state", () => {
    const scheduler = new ActingScheduler(BONE_NAMES);
    scheduler.act("bow", { duration: 1 });
    const before = scheduler.get_state();

    const result = scheduler.act("unknown-action", { duration: 1 });

    expect(result.accepted).toBe(false);
    expect(result.reason).toContain("Unknown");
    expect(scheduler.get_state()).toEqual(before);
  });

  it("rejects sequences that would exceed the 32-item queue without changing state", () => {
    const scheduler = new ActingScheduler(BONE_NAMES);
    scheduler.act("bow", { duration: 1 });
    const before = scheduler.get_state();

    const result = scheduler.sequence(
      Array.from({ length: 34 }, () => ({ action: "bow" as const, duration: 1 })),
    );

    expect(result.accepted).toBe(false);
    expect(scheduler.get_state()).toEqual(before);
  });

  it("starts a sequence immediately and advances queued actions in order", () => {
    const scheduler = new ActingScheduler(BONE_NAMES);

    const result = scheduler.sequence([
      { action: "look_left", duration: 0.1 },
      { action: "look_right", duration: 0.1 },
    ]);

    expect(result.accepted).toBe(true);
    expect(result.state.activeAction?.action).toBe("look_left");
    expect(result.state.queueLength).toBe(1);

    scheduler.tick(0.1);
    expect(scheduler.get_state().activeAction?.action).toBe("look_right");
    expect(scheduler.get_state().queueLength).toBe(0);

    scheduler.tick(0.1);
    expect(scheduler.get_state().activeAction).toBeUndefined();
  });

  it("consumes overshoot across every completed action in a sequence", () => {
    const scheduler = new ActingScheduler(BONE_NAMES);
    scheduler.sequence([
      { action: "look_left", duration: 0.05 },
      { action: "look_right", duration: 0.05 },
    ]);

    scheduler.tick(0.15);

    expect(scheduler.get_state()).toMatchObject({
      elapsed: 0,
      remaining: 0,
      queueLength: 0,
    });
    expect(scheduler.get_state().activeAction).toBeUndefined();
  });

  it("interrupts an active action and clears its queue when a new command arrives", () => {
    const scheduler = new ActingScheduler(BONE_NAMES);
    scheduler.sequence([
      { action: "look_left", duration: 1 },
      { action: "wave", duration: 1 },
    ]);
    scheduler.tick(0.1);

    scheduler.act("bow", { duration: 1 });

    expect(scheduler.get_state()).toMatchObject({
      activeAction: { action: "bow", duration: 1 },
      queueLength: 0,
    });
  });

  it("explicitly interrupts to idle when configured", () => {
    const scheduler = new ActingScheduler(BONE_NAMES, { autoIdle: true });
    scheduler.act("wave", { duration: 1 });

    const result = scheduler.interrupt();

    expect(result.accepted).toBe(true);
    expect(result.state.activeAction).toEqual({ action: "idle" });
    expect(result.state.queueLength).toBe(0);
  });

  it("keeps idle continuous until interrupted", () => {
    const scheduler = new ActingScheduler(BONE_NAMES);
    scheduler.act("idle");

    scheduler.tick(10);

    expect(scheduler.get_state()).toMatchObject({
      activeAction: { action: "idle" },
      elapsed: 10,
      remaining: Infinity,
    });
  });

  it("blends from the captured pose over the default 180ms", () => {
    const scheduler = new ActingScheduler(BONE_NAMES);
    scheduler.act("look_left", { duration: 1 });
    const captured = scheduler.tick(0.1);

    scheduler.act("look_right", { duration: 1 });
    const frame = scheduler.tick(0.09);

    expect(frame).toEqual(
      blendBoneRotations(
        captured,
        sampleActingPrimitive(
          { action: "look_right", duration: 1 },
          { elapsed: 0.09, duration: 1 },
          BONE_NAMES,
        ),
        BONE_NAMES,
        0.5,
      ),
    );
    expect(scheduler.get_state().blendRemaining).toBeCloseTo(0.09);
  });

  it("returns a full identity pose while idle with auto-idle disabled", () => {
    const scheduler = new ActingScheduler(BONE_NAMES);

    expect(scheduler.tick(0)).toEqual(identityPose(BONE_NAMES));
  });
});
