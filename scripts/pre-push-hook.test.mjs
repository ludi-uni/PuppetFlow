import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("git hooks", () => {
  it("defines a pre-push hook that runs lint and format checks", () => {
    const hook = readFileSync(path.join(root, ".githooks", "pre-push"), "utf8");
    const runner = readFileSync(
      path.join(root, "scripts", "pre-push-hook.mjs"),
      "utf8",
    );

    expect(hook).toContain("pre-push-hook.mjs");
    expect(runner).toContain("pnpm lint");
    expect(runner).toContain("pnpm format:check");
  });
});
