import { describe, expect, it } from "vitest";
import { validateReplayOptions } from "./replay.js";

describe("replay command validation", () => {
  it("requires positive speed and non-negative offset", () => {
    expect(
      validateReplayOptions({ input: "session.pfmotion", speed: 2, startOffsetMs: 10 }),
    ).toEqual({
      input: "session.pfmotion",
      speed: 2,
      startOffsetMs: 10,
    });
    expect(() =>
      validateReplayOptions({ input: "session.pfmotion", speed: 0 }),
    ).toThrow();
    expect(() =>
      validateReplayOptions({ input: "session.pfmotion", startOffsetMs: -1 }),
    ).toThrow();
  });
});
