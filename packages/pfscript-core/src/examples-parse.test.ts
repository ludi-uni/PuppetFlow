import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compilePfScript } from "./compile.js";
import { parsePfScript } from "./parser.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readExample(name: string): string {
  return readFileSync(join(repoRoot, "examples/pfscript", name), "utf8");
}

describe("official PFScript examples", () => {
  it("parses basic-smile.pfscript", () => {
    const program = parsePfScript(readExample("basic-smile.pfscript"));
    expect(program.body.length).toBeGreaterThanOrEqual(2);
  });

  it("compiles lipsync-thinking.pfscript", () => {
    const behavior = compilePfScript(readExample("lipsync-thinking.pfscript"));
    expect(behavior.statements.length).toBeGreaterThanOrEqual(5);
  });

  it("compiles random-toggle.pfscript", () => {
    const behavior = compilePfScript(readExample("random-toggle.pfscript"));
    expect(behavior.statements.length).toBeGreaterThanOrEqual(2);
  });
});
