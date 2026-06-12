import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHONEME_SHAPES,
  getPhonemeShape,
  resolvePhoneme,
} from "./phoneme-shapes.js";

describe("phoneme-shapes", () => {
  it("resolves Japanese and Latin aliases", () => {
    expect(resolvePhoneme("あ")).toBe("A");
    expect(resolvePhoneme("i")).toBe("I");
    expect(resolvePhoneme("unknown")).toBe("Rest");
  });

  it("provides distinct shapes for aiueo", () => {
    const a = getPhonemeShape("A");
    const i = getPhonemeShape("I");
    const u = getPhonemeShape("U");
    const e = getPhonemeShape("E");
    const o = getPhonemeShape("O");

    expect(a.mouthX).not.toBe(i.mouthX);
    expect(u.mouthY).not.toBe(e.mouthY);
    expect(o.mouthY).toBeGreaterThan(DEFAULT_PHONEME_SHAPES.Rest.mouthY);
  });
});
