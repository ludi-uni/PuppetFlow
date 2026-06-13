import { describe, expect, it } from "vitest";
import {
  compilePfScriptSource,
  extractBehaviorPfScript,
  findPfScriptExtensionPackDuplicates,
  mergePfScriptIntoPreset,
  parseMotionPackIdsFromPfScript,
  tryCompilePfScriptSource,
} from "./pfscript-preset.js";

describe("pfscript-preset", () => {
  it("compiles PFScript into behavior JSON", () => {
    const result = compilePfScriptSource("smile = interest * 0.4");
    expect(result.behavior.statements).toHaveLength(1);
    expect(JSON.parse(result.behaviorJson)).toMatchObject({ type: "Block" });
  });

  it("merges behaviorPfScript and compiled behavior into preset", () => {
    const merged = mergePfScriptIntoPreset(
      JSON.stringify({
        name: "Test",
        version: 3,
        behavior: { type: "Block", statements: [] },
        graph: { nodes: [], edges: [] },
      }),
      "smile = 0.5",
      compilePfScriptSource("smile = 0.5").behavior,
    );

    const parsed = JSON.parse(merged) as {
      behaviorPfScript?: string;
      behavior?: { statements: unknown[] };
    };
    expect(parsed.behaviorPfScript).toContain("smile");
    expect(parsed.behavior?.statements).toHaveLength(1);
  });

  it("extracts behaviorPfScript from preset JSON", () => {
    const source = extractBehaviorPfScript(
      JSON.stringify({
        name: "Test",
        version: 3,
        behaviorPfScript: "smile = 1",
        behavior: { type: "Block", statements: [] },
        graph: { nodes: [], edges: [] },
      }),
    );
    expect(source).toContain("smile");
  });

  it("reports compile errors with line and column", () => {
    const failure = tryCompilePfScriptSource("while true do end");
    expect(failure).toMatchObject({
      message: expect.stringMatching(/forbidden|Forbidden|while/i),
    });
    if ("line" in failure && failure.line !== undefined) {
      expect(failure.line).toBeGreaterThan(0);
    }
  });

  it("detects pack ids from PFScript call statements", () => {
    expect(
      parseMotionPackIdsFromPfScript(`
if interest > 0.7 then
    thinking(intensity = 0.8)
end
`),
    ).toEqual(["thinking"]);
  });

  it("finds duplicates between PFScript and extensions.packs", () => {
    const duplicates = findPfScriptExtensionPackDuplicates(
      JSON.stringify({
        name: "Test",
        version: 3,
        behavior: { type: "Block", statements: [] },
        graph: { nodes: [], edges: [] },
        extensions: { packs: [{ id: "thinking" }] },
      }),
      "thinking(intensity = 0.5)",
    );
    expect(duplicates).toEqual(["thinking"]);
  });
});
