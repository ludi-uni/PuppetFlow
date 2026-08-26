import { describe, expect, it } from "vitest";
import { TimelineSourceParseError } from "./errors.js";
import { parseRhubarbJson } from "./rhubarb.js";

describe("parseRhubarbJson", () => {
  it("converts ordered cues without filling gaps", () => {
    const input = {
      metadata: { duration: 0.5 },
      mouthCues: [
        { start: 0, end: 0.12, value: "a" },
        { start: 0.2, end: 0.5, value: "X" },
      ],
    };

    expect(parseRhubarbJson(input, { offsetMs: 20 })).toEqual([
      {
        startMs: 20,
        endMs: 140,
        type: "rhubarb-mouth",
        value: { shape: "A" },
      },
      {
        startMs: 220,
        endMs: 520,
        type: "rhubarb-mouth",
        value: { shape: "X" },
      },
    ]);
  });

  it("rejects malformed, unknown, overlapping, descending, and rounded-empty cues", () => {
    const cases: Array<[unknown, string]> = [
      [{}, "mouthCues"],
      [{ mouthCues: [{ start: 0, end: 1, value: "Z" }] }, "mouthCues[0].value"],
      [
        {
          mouthCues: [
            { start: 0, end: 0.2, value: "A" },
            { start: 0.1, end: 0.3, value: "B" },
          ],
        },
        "mouthCues[1].start",
      ],
      [
        { mouthCues: [{ start: Number.NaN, end: 0.1, value: "A" }] },
        "mouthCues[0].start",
      ],
      [{ mouthCues: [{ start: 0.001, end: 0.0011, value: "A" }] }, "mouthCues[0].end"],
    ];

    for (const [input, path] of cases) {
      try {
        parseRhubarbJson(input);
        throw new Error(`expected rejection at ${path}`);
      } catch (error) {
        expect(error).toBeInstanceOf(TimelineSourceParseError);
        expect((error as TimelineSourceParseError).sourceId).toBe("rhubarb");
        expect((error as TimelineSourceParseError).path).toBe(path);
      }
    }
  });

  it("validates metadata, handles empty cues, and never mutates input", () => {
    const input = { metadata: { duration: 0 }, mouthCues: [] };
    const before = structuredClone(input);

    expect(parseRhubarbJson(input)).toEqual([]);
    expect(input).toEqual(before);
    expect(() =>
      parseRhubarbJson({ metadata: { duration: -1 }, mouthCues: [] }),
    ).toThrow(TimelineSourceParseError);
  });
});
