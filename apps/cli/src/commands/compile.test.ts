import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { compileCommand } from "./compile.js";

describe("compile command", () => {
  it("writes a canonical compiled preset JSON file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "puppetflow-cli-compile-"));
    const output = join(directory, "Curious.pfpreset");

    try {
      await compileCommand({ preset: "Curious", output });

      const compiled = JSON.parse(await readFile(output, "utf8")) as {
        name: string;
        version: number;
        behavior: unknown;
      };
      expect(compiled).toMatchObject({ name: "Curious", version: 3 });
      expect(compiled.behavior).toBeDefined();
      expect(await readFile(output, "utf8")).toMatch(/\n$/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("requires exactly one preset or config input and an output", async () => {
    await expect(compileCommand({ output: "out.pfpreset" })).rejects.toThrow(
      /exactly one/i,
    );
    await expect(compileCommand({ preset: "Curious" })).rejects.toThrow(/output/i);
  });

  it("does not overwrite a file preset used as input", async () => {
    const input = "examples/pfscript/pfscript-demo.pfpreset";

    await expect(compileCommand({ preset: input, output: input })).rejects.toThrow(
      /must not overwrite/i,
    );
  });
});
