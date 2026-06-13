import { describe, expect, it } from "vitest";
import { compileToBehaviorJson } from "./compile.js";

describe("compileToBehaviorJson", () => {
  it("returns JSON for a compiled behavior block", () => {
    const json = compileToBehaviorJson("smile = 0.5");
    const parsed = JSON.parse(json) as { type: string; statements: unknown[] };

    expect(parsed.type).toBe("Block");
    expect(parsed.statements).toHaveLength(1);
  });
});
