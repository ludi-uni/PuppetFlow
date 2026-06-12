import { clamp01 } from "./motion-state.js";

export const PHONEME_KEYS = ["A", "I", "U", "E", "O", "N", "Rest"] as const;

export type PhonemeKey = (typeof PHONEME_KEYS)[number];

export interface PhonemeShape {
  mouthX: number;
  mouthY: number;
}

/** あいうえお + ん + Rest — mouthX / mouthY lookup table */
export const DEFAULT_PHONEME_SHAPES: Record<PhonemeKey, PhonemeShape> = {
  A: { mouthX: 0.85, mouthY: 0.75 },
  I: { mouthX: 0.15, mouthY: 0.35 },
  U: { mouthX: 0.1, mouthY: 0.55 },
  E: { mouthX: 0.45, mouthY: 0.4 },
  O: { mouthX: 0.25, mouthY: 0.8 },
  N: { mouthX: 0.0, mouthY: 0.1 },
  Rest: { mouthX: 0.0, mouthY: 0.0 },
};

const PHONEME_ALIASES: Record<string, PhonemeKey> = {
  a: "A",
  i: "I",
  u: "U",
  e: "E",
  o: "O",
  n: "N",
  rest: "Rest",
  あ: "A",
  い: "I",
  う: "U",
  え: "E",
  お: "O",
  ん: "N",
};

export function resolvePhoneme(value: unknown): PhonemeKey {
  if (typeof value !== "string" || value.length === 0) {
    return "Rest";
  }

  const trimmed = value.trim();
  if ((PHONEME_KEYS as readonly string[]).includes(trimmed)) {
    return trimmed as PhonemeKey;
  }

  const alias = PHONEME_ALIASES[trimmed.toLowerCase()] ?? PHONEME_ALIASES[trimmed];
  return alias ?? "Rest";
}

export function getPhonemeShape(
  phoneme: unknown,
  table: Record<PhonemeKey, PhonemeShape> = DEFAULT_PHONEME_SHAPES,
): PhonemeShape {
  const key = resolvePhoneme(phoneme);
  const shape = table[key];
  return {
    mouthX: clamp01(shape.mouthX),
    mouthY: clamp01(shape.mouthY),
  };
}
