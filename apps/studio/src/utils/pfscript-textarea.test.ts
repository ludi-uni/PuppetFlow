import { describe, expect, it } from "vitest";
import {
  applyEnterKey,
  applyTabKey,
  computeNextLineIndent,
  handleBackspaceAtIndent,
  indentSelectedLines,
  PFSCRIPT_INDENT,
} from "./pfscript-textarea.js";

describe("pfscript-textarea", () => {
  it("continues indent after if/then", () => {
    expect(computeNextLineIndent("if interest > 0.7 then", 22)).toBe(PFSCRIPT_INDENT);
  });

  it("continues indent after assignment with trailing =", () => {
    expect(computeNextLineIndent("smile =", 7)).toBe(PFSCRIPT_INDENT);
  });

  it("dedents after end", () => {
    expect(computeNextLineIndent("  end", 5)).toBe("");
  });

  it("inserts indent on Tab", () => {
    const result = applyTabKey("smile", 2, 2, false);
    expect(result.value).toBe(`sm${PFSCRIPT_INDENT}ile`);
    expect(result.selectionStart).toBe(2 + PFSCRIPT_INDENT.length);
  });

  it("indents selected lines on Tab", () => {
    const source = "if x then\nsmile = 1\nend";
    const result = indentSelectedLines(source, 0, source.length, false);
    expect(result.value).toBe(
      `${PFSCRIPT_INDENT}if x then\n${PFSCRIPT_INDENT}smile = 1\n${PFSCRIPT_INDENT}end`,
    );
  });

  it("dedents selected lines on Shift+Tab", () => {
    const source = `${PFSCRIPT_INDENT}if x then\n${PFSCRIPT_INDENT}smile = 1`;
    const result = indentSelectedLines(source, 0, source.length, true);
    expect(result.value).toBe("if x then\nsmile = 1");
  });

  it("auto-indents on Enter after then", () => {
    const source = "if interest > 0.7 then";
    const result = applyEnterKey(source, source.length, source.length);
    expect(result.value).toBe(`if interest > 0.7 then\n${PFSCRIPT_INDENT}`);
    expect(result.selectionStart).toBe(source.length + 1 + PFSCRIPT_INDENT.length);
  });

  it("removes one indent level with Backspace inside whitespace prefix", () => {
    const source = `${PFSCRIPT_INDENT}${PFSCRIPT_INDENT}x = 1`;
    const cursor = PFSCRIPT_INDENT.length * 2;
    const result = handleBackspaceAtIndent(source, cursor, cursor);
    expect(result?.value).toBe(`${PFSCRIPT_INDENT}x = 1`);
    expect(result?.selectionStart).toBe(PFSCRIPT_INDENT.length);
  });
});
