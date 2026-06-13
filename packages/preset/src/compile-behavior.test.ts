import { describe, expect, it } from "vitest";
import { compilePresetBehavior, PresetPfScriptError } from "./compile-behavior.js";

describe("compilePresetBehavior", () => {
  it("compiles behaviorPfScript into a behavior block", () => {
    const compiled = compilePresetBehavior({
      behaviorPfScript: `
smile = interest * 0.4
mouthOpen = volume
`,
    });

    expect(compiled.behaviorPfScript).toContain("smile");
    expect(compiled.behavior.statements).toHaveLength(2);
    expect(compiled.behavior.statements[0]).toMatchObject({
      type: "ExprAssign",
      target: "mouthX",
    });
  });

  it("prefers behaviorPfScript over cached behavior JSON", () => {
    const compiled = compilePresetBehavior({
      behaviorPfScript: "smile = 0.8",
      behavior: {
        type: "Block",
        statements: [{ type: "Assign", key: "mouthX", op: "set", value: 0.1 }],
      },
    });

    expect(compiled.behavior.statements[0]).toMatchObject({
      type: "ExprAssign",
      target: "mouthX",
      value: { type: "Number", value: 0.8 },
    });
  });

  it("validates behavior JSON when PFScript is absent", () => {
    const compiled = compilePresetBehavior({
      behavior: {
        type: "Block",
        statements: [{ type: "Assign", key: "mouthX", op: "set", value: 0.3 }],
      },
    });

    expect(compiled.behavior.statements).toHaveLength(1);
    expect(compiled.behaviorPfScript).toBeUndefined();
  });

  it("requires behavior or behaviorPfScript", () => {
    expect(() => compilePresetBehavior({})).toThrow(/requires behavior or behaviorPfScript/i);
  });

  it("reports PFScript parse errors with line and column", () => {
    expect(() =>
      compilePresetBehavior({
        behaviorPfScript: "while true do end",
      }),
    ).toThrow(PresetPfScriptError);

    try {
      compilePresetBehavior({
        behaviorPfScript: "while true do end",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(PresetPfScriptError);
      const scriptError = error as PresetPfScriptError;
      expect(scriptError.line).toBeGreaterThan(0);
      expect(scriptError.column).toBeGreaterThan(0);
    }
  });
});
