import { describe, expect, it } from "vitest";

import {
  mergeMicroBehaviorDefinitions,
  parseMicroBehaviorsFile,
  serializeMicroBehaviorsFile,
} from "./micro-behaviors-file.js";

const SAMPLE = {
  id: "wave",
  duration: 1,
  cooldown: 2,
  keyframes: [{ t: 0, params: { lookY: 0.5 } }],
};

describe("micro-behaviors-file", () => {
  it("parses versioned file objects", () => {
    const parsed = parseMicroBehaviorsFile({
      version: 1,
      behaviors: [SAMPLE],
    });

    expect(parsed).toEqual([SAMPLE]);
  });

  it("parses bare behavior arrays", () => {
    expect(parseMicroBehaviorsFile([SAMPLE])).toEqual([SAMPLE]);
  });

  it("rejects built-in ids", () => {
    expect(() =>
      parseMicroBehaviorsFile({
        version: 1,
        behaviors: [{ ...SAMPLE, id: "look_up" }],
      }),
    ).toThrow(/look_up/);
  });

  it("round-trips through serialize", () => {
    const json = serializeMicroBehaviorsFile([SAMPLE]);
    expect(parseMicroBehaviorsFile(JSON.parse(json))).toEqual([SAMPLE]);
  });

  it("merges by id", () => {
    const merged = mergeMicroBehaviorDefinitions(
      [SAMPLE],
      [{ ...SAMPLE, duration: 2, id: "nod" }],
    );

    expect(merged.map((entry) => entry.id)).toEqual(["nod", "wave"]);
    expect(merged.find((entry) => entry.id === "wave")?.duration).toBe(1);
  });
});
