import type { TimelineEvent } from "@puppetflow/core";
import { TimelineSourceParseError } from "./errors.js";
import type { TimelineSource, TimelineSourceOptions } from "./types.js";
import {
  addOffset,
  optionalFiniteNumber,
  parseOffsetMs,
  requireArray,
  requireFiniteNumber,
  requireRecord,
} from "./validation.js";

type Phoneme = "A" | "I" | "U" | "E" | "O" | "N" | "Rest";

const SOURCE_ID = "voicevox-audio-query" as const;

const PHONEMES: Readonly<Record<string, Phoneme>> = {
  a: "A",
  i: "I",
  u: "U",
  e: "E",
  o: "O",
  n: "N",
  sil: "Rest",
  pau: "Rest",
};

function requireVowel(value: unknown, path: string): Phoneme {
  if (typeof value !== "string") {
    throw new TimelineSourceParseError(SOURCE_ID, path, "must be a known vowel");
  }

  const phoneme = PHONEMES[value.toLowerCase()];
  if (phoneme === undefined) {
    throw new TimelineSourceParseError(SOURCE_ID, path, "must be a known vowel");
  }
  return phoneme;
}

function requireOptionalConsonant(value: unknown, path: string): void {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new TimelineSourceParseError(SOURCE_ID, path, "must be a string");
  }
}

export function parseVoicevoxAudioQuery(
  input: unknown,
  options?: TimelineSourceOptions,
): readonly TimelineEvent[] {
  const root = requireRecord(SOURCE_ID, "input", input);
  const offsetMs = parseOffsetMs(SOURCE_ID, options);
  const accentPhrases = requireArray(SOURCE_ID, "accent_phrases", root.accent_phrases);
  const prePhonemeLength = requireFiniteNumber(
    SOURCE_ID,
    "prePhonemeLength",
    root.prePhonemeLength,
    0,
  );
  const postPhonemeLength = requireFiniteNumber(
    SOURCE_ID,
    "postPhonemeLength",
    root.postPhonemeLength,
    0,
  );
  const speedScale = requireFiniteNumber(SOURCE_ID, "speedScale", root.speedScale, 0);
  if (speedScale === 0) {
    throw new TimelineSourceParseError(
      SOURCE_ID,
      "speedScale",
      "must be a positive finite number",
    );
  }

  const pauseLength = optionalFiniteNumber(
    SOURCE_ID,
    "pauseLength",
    root.pauseLength,
    0,
  );
  const pauseLengthScale =
    optionalFiniteNumber(SOURCE_ID, "pauseLengthScale", root.pauseLengthScale, 0) ?? 1;

  let cursorSeconds = 0;
  const events: TimelineEvent[] = [];

  function emit(durationSeconds: number, phoneme: Phoneme, path: string): void {
    const startSeconds = cursorSeconds;
    const scaledSeconds = durationSeconds / speedScale;
    requireFiniteNumber(SOURCE_ID, path, scaledSeconds, 0);
    cursorSeconds += scaledSeconds;
    requireFiniteNumber(SOURCE_ID, path, cursorSeconds, 0);

    const startMs = addOffset(
      SOURCE_ID,
      path,
      offsetMs,
      Math.round(startSeconds * 1000),
    );
    const endMs = addOffset(
      SOURCE_ID,
      path,
      offsetMs,
      Math.round(cursorSeconds * 1000),
    );
    if (endMs < startMs) {
      throw new TimelineSourceParseError(
        SOURCE_ID,
        path,
        "rounded time moved backwards",
      );
    }
    if (endMs === startMs) {
      return;
    }
    events.push({
      startMs,
      endMs,
      type: "phoneme",
      value: { phoneme, strength: 1 },
    });
  }

  emit(prePhonemeLength, "Rest", "prePhonemeLength");

  for (const [phraseIndex, rawPhrase] of accentPhrases.entries()) {
    const phrasePath = `accent_phrases[${phraseIndex}]`;
    const phrase = requireRecord(SOURCE_ID, phrasePath, rawPhrase);
    const moras = requireArray(SOURCE_ID, `${phrasePath}.moras`, phrase.moras);

    for (const [moraIndex, rawMora] of moras.entries()) {
      const moraPath = `${phrasePath}.moras[${moraIndex}]`;
      const mora = requireRecord(SOURCE_ID, moraPath, rawMora);
      const phoneme = requireVowel(mora.vowel, `${moraPath}.vowel`);
      const vowelLength = requireFiniteNumber(
        SOURCE_ID,
        `${moraPath}.vowel_length`,
        mora.vowel_length,
        0,
      );
      const consonantLength =
        optionalFiniteNumber(
          SOURCE_ID,
          `${moraPath}.consonant_length`,
          mora.consonant_length,
          0,
        ) ?? 0;
      requireOptionalConsonant(mora.consonant, `${moraPath}.consonant`);
      emit(consonantLength + vowelLength, phoneme, moraPath);
    }

    if (phrase.pause_mora !== undefined && phrase.pause_mora !== null) {
      const pausePath = `${phrasePath}.pause_mora`;
      const pauseMora = requireRecord(SOURCE_ID, pausePath, phrase.pause_mora);
      requireVowel(pauseMora.vowel, `${pausePath}.vowel`);
      const pauseMoraLength = requireFiniteNumber(
        SOURCE_ID,
        `${pausePath}.vowel_length`,
        pauseMora.vowel_length,
        0,
      );
      optionalFiniteNumber(
        SOURCE_ID,
        `${pausePath}.consonant_length`,
        pauseMora.consonant_length,
        0,
      );
      requireOptionalConsonant(pauseMora.consonant, `${pausePath}.consonant`);
      emit((pauseLength ?? pauseMoraLength) * pauseLengthScale, "Rest", pausePath);
    }
  }

  emit(postPhonemeLength, "Rest", "postPhonemeLength");
  return events;
}

export const voicevoxAudioQuerySource: TimelineSource<unknown> = {
  id: SOURCE_ID,
  parse: parseVoicevoxAudioQuery,
};
