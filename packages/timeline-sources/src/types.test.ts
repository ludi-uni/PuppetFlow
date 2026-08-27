import { describe, expect, it } from "vitest";
import { TimelineSourceParseError } from "./errors.js";
import { addOffset, isRecord, parseOffsetMs } from "./validation.js";

describe("timeline source contract", () => {
  it("recognizes plain records but not null or arrays", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
  });

  it("defaults offsetMs to zero and accepts finite non-negative values", () => {
    expect(parseOffsetMs("test", undefined)).toBe(0);
    expect(parseOffsetMs("test", { offsetMs: 125.5 })).toBe(125.5);
  });

  it.each([{ offsetMs: -1 }, { offsetMs: Number.NaN }, { offsetMs: Infinity }])(
    "rejects invalid offset %#",
    (options) => {
      expect(() => parseOffsetMs("test", options)).toThrow(TimelineSourceParseError);
    },
  );

  it.each([
    [Number.MAX_VALUE, Number.MAX_VALUE],
    [-1, 0],
  ])("rejects computed boundary outside the timeline %#", (offsetMs, boundaryMs) => {
    expect(() => addOffset("test", "computed", offsetMs, boundaryMs)).toThrow(
      TimelineSourceParseError,
    );
  });

  it("keeps source ID, path, name, and message on parse errors", () => {
    const error = new TimelineSourceParseError(
      "test",
      "input.value",
      "must be a number",
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("TimelineSourceParseError");
    expect(error.sourceId).toBe("test");
    expect(error.path).toBe("input.value");
    expect(error.message).toContain("input.value");
  });
});
