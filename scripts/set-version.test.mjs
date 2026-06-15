import { describe, expect, it } from "vitest";
import { parseVersionTag } from "./lib/semver-version.mjs";

describe("parseVersionTag", () => {
  it("accepts valid semver tags", () => {
    for (const raw of ["v1.2.3", "1.2.3", "v1.2.3-rc.1", "v1.2.3+build.1"]) {
      const result = parseVersionTag(raw);
      expect(result.ok, raw).toBe(true);
      expect(result.version).toBe(raw.replace(/^v/, ""));
    }
  });

  it("rejects invalid semver tags", () => {
    for (const raw of [
      "v1.2",
      "v1.2.3_alpha",
      'v1.2.3"; echo pwned',
      "not-a-version",
    ]) {
      expect(parseVersionTag(raw).ok, raw).toBe(false);
    }
  });
});
