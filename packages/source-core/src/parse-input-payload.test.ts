import { ChannelStore, StateStore, TimelineStore } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import { applyInputPayload } from "./parse-input-payload.js";

describe("applyInputPayload", () => {
  it("applies state, channels, and timeline from structured payload", () => {
    const target = {
      state: new StateStore(),
      channels: new ChannelStore(),
      timeline: new TimelineStore(),
    };

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

  it("keeps backward-compatible flat state payload", () => {
    const target = {
      state: new StateStore(),
      channels: new ChannelStore(),
      timeline: new TimelineStore(),
    };

    applyInputPayload(target, { energy: 0.4 });
    expect(target.state.get("energy")).toBe(0.4);
  });

  it("rejects oversized timeline arrays", () => {
    const target = {
      state: new StateStore(),
      channels: new ChannelStore(),
      timeline: new TimelineStore(),
    };

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
    const target = {
      state: new StateStore(),
      channels: new ChannelStore(),
      timeline: new TimelineStore(),
    };

    const channels = Object.fromEntries(
      Array.from({ length: 129 }, (_, index) => [`key${index}`, index]),
    );

    expect(() => applyInputPayload(target, { channels })).toThrow(
      /channels exceed max keys/i,
    );
  });

  it("skips timeline events with invalid duration", () => {
    const target = {
      state: new StateStore(),
      channels: new ChannelStore(),
      timeline: new TimelineStore(),
    };

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
});
