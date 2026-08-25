import { describe, expect, it } from "vitest";

import { validateCommand } from "./validate.js";

describe("validate command", () => {
  it("validates a built-in preset without starting a runtime", async () => {
    await expect(validateCommand({ preset: "Curious" })).resolves.toBeUndefined();
  });

  it("validates a YAML config and its referenced preset", async () => {
    await expect(
      validateCommand({ configPath: "examples/cli/puppetflow.yaml" }),
    ).resolves.toBeUndefined();
  });

  it("requires exactly one preset or config input", async () => {
    await expect(validateCommand({})).rejects.toThrow(/exactly one/i);
    await expect(
      validateCommand({ preset: "Curious", configPath: "puppetflow.yaml" }),
    ).rejects.toThrow(/exactly one/i);
  });
});
