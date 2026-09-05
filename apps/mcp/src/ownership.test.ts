import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("workspace MCP ownership boundary", () => {
  it("has no production dependency or loader for Runtime, Host, VMC, or PUPPETFLOW_ROOT", () => {
    const appRoot = resolve(import.meta.dirname, "..");
    const packageJson = JSON.parse(
      readFileSync(resolve(appRoot, "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
    };
    expect(packageJson.dependencies).not.toHaveProperty("@puppetflow/runtime");
    expect(packageJson.dependencies).not.toHaveProperty("@puppetflow/runtime-launcher");
    expect(packageJson.dependencies).not.toHaveProperty("@puppetflow/adapter-vmc");

    const source = [
      "control.ts",
      "errors.ts",
      "index.ts",
      "main.ts",
      "results.ts",
      "schemas.ts",
      "server.ts",
      "shared-control-client.ts",
      "tools.ts",
    ]
      .map((file) => readFileSync(resolve(appRoot, "src", file), "utf8"))
      .join("\n");
    expect(source).not.toMatch(
      /PUPPETFLOW_ROOT|host-module|createPuppetFlowHost|PuppetFlowRuntime|VMC/,
    );
  });
});
