import { describe, expect, it } from "vitest";
import { validateRecordOptions } from "./record.js";

describe("record command validation", () => {
  it("accepts a bounded duration and rejects negative durations", () => {
    expect(
      validateRecordOptions({ output: "session.pfmotion", durationMs: 0 }),
    ).toEqual({
      output: "session.pfmotion",
      durationMs: 0,
    });
    expect(() =>
      validateRecordOptions({ output: "session.pfmotion", durationMs: -1 }),
    ).toThrow();
  });
});
