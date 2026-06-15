import { describe, expect, it } from "vitest";
import { bumpPatch, resolveNextReleaseTag } from "./lib/next-version.mjs";

describe("bumpPatch", () => {
  it("increments patch version", () => {
    expect(bumpPatch("0.1.3")).toBe("0.1.4");
    expect(bumpPatch("1.2.9")).toBe("1.2.10");
  });
});

describe("resolveNextReleaseTag", () => {
  it("bumps the latest tag when HEAD is not tagged", () => {
    expect(
      resolveNextReleaseTag({
        latestTag: "v0.1.3",
        headIsTagged: false,
        manualVersion: "",
        skipRelease: false,
      }),
    ).toEqual({ tag: "v0.1.4", shouldRelease: true });
  });

  it("starts at v0.1.0 when no tags exist", () => {
    expect(
      resolveNextReleaseTag({
        latestTag: null,
        headIsTagged: false,
        manualVersion: "",
        skipRelease: false,
      }),
    ).toEqual({ tag: "v0.1.0", shouldRelease: true });
  });

  it("skips when HEAD is already tagged", () => {
    expect(
      resolveNextReleaseTag({
        latestTag: "v0.1.4",
        headIsTagged: true,
        manualVersion: "",
        skipRelease: false,
      }),
    ).toEqual({ tag: "", shouldRelease: false });
  });

  it("uses manual version for workflow dispatch", () => {
    expect(
      resolveNextReleaseTag({
        latestTag: "v0.1.3",
        headIsTagged: false,
        manualVersion: "0.2.0",
        skipRelease: false,
      }),
    ).toEqual({ tag: "v0.2.0", shouldRelease: true });
  });

  it("skips when commit message contains [skip release]", () => {
    expect(
      resolveNextReleaseTag({
        latestTag: "v0.1.3",
        headIsTagged: false,
        manualVersion: "",
        skipRelease: true,
      }),
    ).toEqual({ tag: "", shouldRelease: false });
  });
});
