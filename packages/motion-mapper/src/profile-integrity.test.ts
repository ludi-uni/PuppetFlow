import { describe, expect, it } from "vitest";
import { getDefaultProfile } from "./profiles.js";

describe("profile integrity", () => {
  for (const target of ["vmc", "live2d", "vrm"] as const) {
    it(`has no duplicate OSC params in ${target} default profile`, () => {
      const profile = getDefaultProfile(target);
      const seen = new Map<string, string>();

      for (const [motionKey, rule] of Object.entries(profile.rules)) {
        if (!rule?.param) {
          continue;
        }

        const previous = seen.get(rule.param);
        expect(
          previous,
          `${target}: ${motionKey} and ${previous} both map to ${rule.param}`,
        ).toBeUndefined();
        seen.set(rule.param, motionKey);
      }
    });
  }
});
