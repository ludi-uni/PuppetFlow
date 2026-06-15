import { describe, expect, it } from "vitest";
import { detectSeaSentinel } from "./lib/cli-sea.mjs";

describe("detectSeaSentinel", () => {
  it("finds the fuse marker in the current Node binary", () => {
    const sentinel = detectSeaSentinel(process.execPath);
    expect(sentinel).toMatch(/^NODE_SEA_FUSE_[a-f0-9]{32}$/);
  });
});
