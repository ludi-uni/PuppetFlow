import { describe, expect, it } from "vitest";

import {
  expressionProfileChannels,
  resolveExpressionTarget,
  validateActingExpressionParams,
  validateActingExpressionProfile,
  type ActingExpressionProfile,
} from "./index.js";

const PROFILE: ActingExpressionProfile = {
  id: "test-expressions",
  expressions: {
    happy: { blendShape: "Joy" },
    sad: { blendShape: "Sorrow" },
  },
};

describe("expression profiles", () => {
  it("accepts neutral without a mapped blendshape and resolves mapped semantics", () => {
    expect(resolveExpressionTarget(PROFILE, "neutral")).toBeUndefined();
    expect(resolveExpressionTarget(PROFILE, "happy")).toEqual({
      blendShape: "Joy",
    });
    expect(expressionProfileChannels(PROFILE)).toEqual(["Joy", "Sorrow"]);
  });

  it("rejects unknown or unmapped expressions without inventing a channel", () => {
    expect(() => resolveExpressionTarget(PROFILE, "surprised")).toThrow(/mapping/i);
    expect(() => resolveExpressionTarget(PROFILE, "super_hyper_happy")).toThrow(
      /unknown/i,
    );
  });

  it("rejects empty profile mappings and invalid finite timing", () => {
    expect(() =>
      validateActingExpressionProfile({
        id: "bad",
        expressions: { happy: { blendShape: "" } },
      }),
    ).toThrow(/blendShape/i);
    expect(() => validateActingExpressionParams({ intensity: Infinity })).toThrow(
      /intensity/i,
    );
    expect(() => validateActingExpressionParams({ fadeIn: -0.01 })).toThrow(/fadeIn/i);
  });

  it("enforces expression parameter boundaries", () => {
    expect(() =>
      validateActingExpressionParams({
        intensity: 0,
        duration: 0.05,
        fadeIn: 0,
        fadeOut: 30,
      }),
    ).not.toThrow();
    expect(() => validateActingExpressionParams({ intensity: 1.01 })).toThrow(
      /intensity/i,
    );
    expect(() => validateActingExpressionParams({ duration: 30.01 })).toThrow(
      /duration/i,
    );
    expect(() => validateActingExpressionParams({ fadeOut: 30.01 })).toThrow(
      /fadeOut/i,
    );
  });
});
