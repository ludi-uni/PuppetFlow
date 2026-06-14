import { describe, expect, it } from "vitest";
import {
  PFSCRIPT_BUILTIN_FUNCTION_NAMES,
  PFSCRIPT_EXPRESSION_CALLEES,
  PFSCRIPT_STATEFUL_FUNCTION_NAMES,
  isPfScriptBuiltinFunction,
  isPfScriptStatefulFunction,
} from "./pfscript-function-catalog.js";

describe("pfscript-function-catalog", () => {
  it("lists math builtins and stateful functions without name collisions", () => {
    const builtinSet = new Set(PFSCRIPT_BUILTIN_FUNCTION_NAMES);
    for (const name of PFSCRIPT_STATEFUL_FUNCTION_NAMES) {
      expect(builtinSet.has(name)).toBe(false);
    }
  });

  it("includes expected PFScript surface names", () => {
    expect(PFSCRIPT_BUILTIN_FUNCTION_NAMES).toContain("noise");
    expect(PFSCRIPT_BUILTIN_FUNCTION_NAMES).toContain("clamp");
    expect(PFSCRIPT_STATEFUL_FUNCTION_NAMES).toContain("oscillator");
    expect(PFSCRIPT_STATEFUL_FUNCTION_NAMES).toContain("wander");
    expect(PFSCRIPT_EXPRESSION_CALLEES).toContain("eventActive");
  });

  it("classifies builtins vs stateful helpers", () => {
    expect(isPfScriptBuiltinFunction("lerp")).toBe(true);
    expect(isPfScriptStatefulFunction("lerp")).toBe(false);
    expect(isPfScriptStatefulFunction("blink")).toBe(true);
    expect(isPfScriptBuiltinFunction("blink")).toBe(false);
  });
});
