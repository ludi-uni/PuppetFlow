import { describe, expect, it } from "vitest";
import { TimelineSourceParseError } from "./errors.js";
import { parseVoicevoxAudioQuery, voicevoxAudioQuerySource } from "./voicevox.js";

const query = {
  prePhonemeLength: 0.1,
  postPhonemeLength: 0.2,
  speedScale: 2,
  accent_phrases: [
    {
      moras: [{ vowel: "a", vowel_length: 0.2, consonant: "k", consonant_length: 0.1 }],
      pause_mora: { vowel: "pau", vowel_length: 0.3 },
    },
    { moras: [{ vowel: "N", vowel_length: 0.05 }] },
  ],
};

describe("parseVoicevoxAudioQuery", () => {
  it("exposes the source contract", () => {
    expect(voicevoxAudioQuerySource.id).toBe("voicevox-audio-query");
    expect(voicevoxAudioQuerySource.parse).toBe(parseVoicevoxAudioQuery);
  });

  it("lays out silence, mora, pause, speed, and offset in order", () => {
    expect(parseVoicevoxAudioQuery(query, { offsetMs: 10 })).toEqual([
      {
        startMs: 10,
        endMs: 60,
        type: "phoneme",
        value: { phoneme: "Rest", strength: 1 },
      },
      {
        startMs: 60,
        endMs: 210,
        type: "phoneme",
        value: { phoneme: "A", strength: 1 },
      },
      {
        startMs: 210,
        endMs: 360,
        type: "phoneme",
        value: { phoneme: "Rest", strength: 1 },
      },
      {
        startMs: 360,
        endMs: 385,
        type: "phoneme",
        value: { phoneme: "N", strength: 1 },
      },
      {
        startMs: 385,
        endMs: 485,
        type: "phoneme",
        value: { phoneme: "Rest", strength: 1 },
      },
    ]);
  });

  it("applies pause overrides, normalizes silence, skips zero lengths, and preserves input", () => {
    const input = {
      ...query,
      prePhonemeLength: 0,
      postPhonemeLength: 0,
      speedScale: 1,
      pauseLength: 0.4,
      pauseLengthScale: 0.5,
      accent_phrases: [
        {
          moras: [
            { vowel: "sil", vowel_length: 0 },
            { vowel: "i", vowel_length: 0.1 },
          ],
        },
        { moras: [], pause_mora: { vowel: "pau", vowel_length: 0.2 } },
      ],
    };
    const before = structuredClone(input);

    expect(parseVoicevoxAudioQuery(input)).toEqual([
      { startMs: 0, endMs: 100, type: "phoneme", value: { phoneme: "I", strength: 1 } },
      {
        startMs: 100,
        endMs: 300,
        type: "phoneme",
        value: { phoneme: "Rest", strength: 1 },
      },
    ]);
    expect(input).toEqual(before);
  });

  it("emits pre/post Rest events for a valid empty phrase list", () => {
    expect(
      parseVoicevoxAudioQuery({
        prePhonemeLength: 0.01,
        postPhonemeLength: 0.02,
        speedScale: 1,
        accent_phrases: [],
      }),
    ).toEqual([
      {
        startMs: 0,
        endMs: 10,
        type: "phoneme",
        value: { phoneme: "Rest", strength: 1 },
      },
      {
        startMs: 10,
        endMs: 30,
        type: "phoneme",
        value: { phoneme: "Rest", strength: 1 },
      },
    ]);
  });

  it.each([
    ["accent_phrases[0].moras[0].vowel", "q"],
    ["speedScale", 0],
    ["accent_phrases[0].moras[0].vowel_length", Number.NaN],
    ["accent_phrases[0].moras", null],
  ])("rejects invalid field %s", (path, value) => {
    const invalid = structuredClone(query) as Record<string, unknown>;
    if (path === "speedScale") {
      invalid.speedScale = value;
    } else if (path.endsWith(".moras")) {
      (invalid.accent_phrases as Array<Record<string, unknown>>)[0]!.moras = value;
    } else {
      const phrase = (invalid.accent_phrases as Array<Record<string, unknown>>)[0]!;
      const mora = (phrase.moras as Array<Record<string, unknown>>)[0]!;
      mora[path.endsWith(".vowel_length") ? "vowel_length" : "vowel"] = value;
    }

    try {
      parseVoicevoxAudioQuery(invalid);
      throw new Error("expected TimelineSourceParseError");
    } catch (error) {
      expect(error).toBeInstanceOf(TimelineSourceParseError);
      expect((error as TimelineSourceParseError).sourceId).toBe("voicevox-audio-query");
      expect((error as TimelineSourceParseError).path).toBe(path);
    }
  });
});
