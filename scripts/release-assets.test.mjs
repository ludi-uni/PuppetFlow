import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isReleaseAsset,
  portableZipName,
  resolveStudioTargetRoot,
} from "./lib/release-assets.mjs";

describe("isReleaseAsset", () => {
  it("accepts portable Studio and CLI zip archives", () => {
    expect(isReleaseAsset("puppetflow-studio-windows-x64-0.1.3-portable.zip")).toBe(
      true,
    );
    expect(isReleaseAsset("pf-cli-windows-x64-0.1.3-portable.zip")).toBe(true);
  });

  it("rejects installer formats", () => {
    expect(isReleaseAsset("PuppetFlow Studio_0.1.0_x64-setup.exe")).toBe(false);
    expect(isReleaseAsset("puppetflow-studio_0.1.0_amd64.deb")).toBe(false);
    expect(isReleaseAsset("PuppetFlow Studio_0.1.0_universal.dmg")).toBe(false);
  });
});

describe("portableZipName", () => {
  it("builds a predictable archive name", () => {
    expect(portableZipName("windows-x64", "0.1.3")).toBe(
      "puppetflow-studio-windows-x64-0.1.3-portable.zip",
    );
  });
});

describe("resolveStudioTargetRoot", () => {
  it("uses universal macOS target directory", () => {
    expect(resolveStudioTargetRoot("macos", "/repo")).toBe(
      path.join("/repo", "apps/studio/src-tauri/target/universal-apple-darwin"),
    );
  });
});
