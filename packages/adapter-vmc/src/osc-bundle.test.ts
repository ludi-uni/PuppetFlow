import { describe, expect, it } from "vitest";
import { encodeBlendShapeMessage } from "./osc-encoder.js";
import { encodeOscBundle, resolveOscTimetag } from "./osc-bundle.js";

describe("resolveOscTimetag", () => {
  it("uses the OSC immediate timetag when requested", () => {
    expect(resolveOscTimetag({ mode: "immediate" })).toEqual(
      new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]),
    );
  });

  it("converts an explicit Unix timestamp to an NTP timetag", () => {
    expect(resolveOscTimetag({ mode: "frame-unix", timestampMs: 1_700_000_000_000 })).toEqual(
      new Uint8Array([232, 254, 111, 128, 0, 0, 0, 0]),
    );
  });
});

describe("encodeOscBundle", () => {
  it("encodes element sizes and a deterministic timetag", () => {
    const message = encodeBlendShapeMessage("Smile", 0.5);
    const bundle = encodeOscBundle([message], {
      mode: "send-time",
      nowMs: 1_700_000_000_000,
    });
    const view = new DataView(bundle.buffer, bundle.byteOffset, bundle.byteLength);

    expect(new TextDecoder().decode(bundle.slice(0, 8))).toBe("#bundle\0");
    expect(bundle.slice(8, 16)).toEqual(
      resolveOscTimetag({ mode: "send-time", nowMs: 1_700_000_000_000 }),
    );
    expect(view.getInt32(16, false)).toBe(message.length);
    expect(bundle.slice(20)).toEqual(message);
  });
});
