import { ChannelStore, StateStore, TimelineStore } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import { MotionOverrideStore } from "./motion-override-store.js";
import { applyInputPayload } from "./parse-input-payload.js";

function createTarget() {
  return {
    state: new StateStore(),
    channels: new ChannelStore(),
    timeline: new TimelineStore(),
    motion: new MotionOverrideStore(),
  };
}

describe("applyInputPayload", () => {
  it("applies state, channels, and timeline from structured payload", () => {
    const target = createTarget();

    applyInputPayload(target, {
      state: { interest: 0.9 },
      channels: { volume: 0.6, emotion: "joy" },
      timeline: [{ startMs: 0, endMs: 100, type: "phoneme", value: { phoneme: "A" } }],
    });

    expect(target.state.get("interest")).toBe(0.9);
    expect(target.channels.get("volume")).toBe(0.6);
    expect(target.channels.get("emotion")).toBe("joy");
    expect(target.timeline.getActiveEvents(50)).toHaveLength(1);
  });

  it("applies motion overrides from structured payload", () => {
    const target = createTarget();

    applyInputPayload(target, {
      motion: {
        mouthX: 0.75,
        lookY: 0.4,
        custom: { heartbeat: 0.6 },
      },
    });

    const rendered = target.motion.applyTo({
      faceYaw: 0.5,
      facePitch: 0.5,
      bodyYaw: 0.5,
      bodyRoll: 0.5,
      eyeYaw: 1,
      eyePitch: 0,
      mouthX: 0,
      mouthY: 0,
      headTilt: 0.5,
      bodyLean: 0.5,
      lookX: 0.5,
      lookY: 0.5,
      custom: {},
    });

    expect(rendered.mouthX).toBe(0.75);
    expect(rendered.lookY).toBe(0.4);
    expect(rendered.custom.heartbeat).toBe(0.6);
  });

  it("keeps backward-compatible flat state payload", () => {
    const target = createTarget();

    applyInputPayload(target, { energy: 0.4 });
    expect(target.state.get("energy")).toBe(0.4);
  });

  it("rejects oversized timeline arrays", () => {
    const target = createTarget();

    const timeline = Array.from({ length: 65 }, (_, index) => ({
      startMs: index,
      endMs: index + 1,
      type: "phoneme",
      value: "A",
    }));

    expect(() => applyInputPayload(target, { timeline })).toThrow(
      /timeline exceeds max events/i,
    );
  });

  it("rejects oversized channel maps", () => {
    const target = createTarget();

    const channels = Object.fromEntries(
      Array.from({ length: 129 }, (_, index) => [`key${index}`, index]),
    );

    expect(() => applyInputPayload(target, { channels })).toThrow(
      /channels exceed max keys/i,
    );
  });

  it("skips timeline events with invalid duration", () => {
    const target = createTarget();

    applyInputPayload(target, {
      timeline: [
        { startMs: 100, endMs: 50, type: "phoneme", value: "A" },
        { startMs: 0, endMs: 400_000, type: "phoneme", value: "B" },
        { startMs: 0, endMs: 100, type: "phoneme", value: "C" },
      ],
    });

    expect(target.timeline.getActiveEvents(50)).toHaveLength(1);
    expect(target.timeline.getActiveEvents(50)[0]?.value).toBe("C");
  });

  it("routes behavior payloads to microBehavior handler", () => {
    const target = createTarget();
    const received: Record<string, unknown>[] = [];

    applyInputPayload(
      {
        ...target,
        microBehavior: {
          applyFromInputRecord(record) {
            received.push(record);
          },
        },
      },
      { behavior: "look_up" },
    );

    expect(received).toHaveLength(1);
    expect(received[0]?.behavior).toBe("look_up");
    expect(target.state.get("behavior")).toBeUndefined();
  });

  it("applies state and behavior from combined payload", () => {
    const target = createTarget();
    let behaviorSeen = false;

    applyInputPayload(
      {
        ...target,
        microBehavior: {
          applyFromInputRecord(record) {
            behaviorSeen = record.behavior === "look_up";
          },
        },
      },
      {
        state: { interest: 0.7 },
        behavior: "look_up",
      },
    );

    expect(behaviorSeen).toBe(true);
    expect(target.state.get("interest")).toBe(0.7);
  });
});
