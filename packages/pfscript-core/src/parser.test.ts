import { describe, expect, it } from "vitest";
import { PfScriptForbiddenError, PfScriptParseError } from "./errors.js";
import { parsePfScript } from "./parser.js";
import { SPEC_SAMPLE_PFSCRIPT } from "./samples.js";
import { tokenize } from "./lexer.js";

describe("pfscript lexer", () => {
  it("tokenizes identifiers and operators", () => {
    const tokens = tokenize("smile = interest * 0.5");
    expect(tokens.map((token) => token.type)).toEqual([
      "identifier",
      "eq",
      "identifier",
      "star",
      "number",
      "eof",
    ]);
  });

  it("skips line comments", () => {
    const tokens = tokenize("-- comment\nsmile = 1").filter(
      (token) => token.type !== "newline",
    );
    expect(tokens[0]?.type).toBe("identifier");
    expect(tokens[0]?.value).toBe("smile");
  });

  it("emits forbidden keyword token", () => {
    const tokens = tokenize("while true do");
    expect(tokens[0]?.type).toBe("forbidden");
    expect(tokens[0]?.value).toBe("while");
  });
});

import type { PfScriptStatement } from "./ast.js";

function containsCallStmt(statements: PfScriptStatement[]): boolean {
  for (const statement of statements) {
    if (statement.type === "CallStmt") {
      return true;
    }
    if (statement.type === "If") {
      if (containsCallStmt(statement.then)) {
        return true;
      }
      for (const clause of statement.elseif) {
        if (containsCallStmt(clause.body)) {
          return true;
        }
      }
      if (statement.else && containsCallStmt(statement.else)) {
        return true;
      }
    }
  }
  return false;
}

describe("pfscript parser", () => {
  it("parses simple assignment", () => {
    const program = parsePfScript("smile = interest * 0.5");
    expect(program.body).toHaveLength(1);
    expect(program.body[0]).toMatchObject({
      type: "Assign",
      target: "smile",
      value: {
        type: "Binary",
        op: "*",
        left: { type: "Identifier", name: "interest" },
        right: { type: "Number", value: 0.5 },
      },
    });
  });

  it("parses multiline assignment", () => {
    const program = parsePfScript("smile =\n    interest * 0.4");
    expect(program.body[0]?.type).toBe("Assign");
  });

  it("parses channel identifier assignment", () => {
    const program = parsePfScript("mouthOpen = volume");
    expect(program.body[0]).toMatchObject({
      type: "Assign",
      target: "mouthOpen",
      value: { type: "Identifier", name: "volume" },
    });
  });

  it("parses function call expression", () => {
    const program = parsePfScript("headTilt = noise(time * 0.2) * 0.1");
    const assign = program.body[0];
    expect(assign?.type).toBe("Assign");
    if (assign?.type === "Assign" && assign.value.type === "Binary") {
      expect(assign.value.left.type).toBe("Call");
    }
  });

  it("parses if/end block", () => {
    const program = parsePfScript(`if interest > 0.7 then
    smile = 0.3
end`);
    expect(program.body[0]?.type).toBe("If");
  });

  it("parses elseif and else", () => {
    const program = parsePfScript(`if energy > 0.8 then
    smile = 0.5
elseif energy > 0.5 then
    smile = 0.3
else
    smile = 0.1
end`);
    const stmt = program.body[0];
    expect(stmt?.type).toBe("If");
    if (stmt?.type === "If") {
      expect(stmt.elseif).toHaveLength(1);
      expect(stmt.else).toHaveLength(1);
    }
  });

  it("parses call statement with named args", () => {
    const program = parsePfScript(`thinking(
    intensity = 0.8
)`);
    expect(program.body[0]).toMatchObject({
      type: "CallStmt",
      callee: "thinking",
    });
  });

  it("parses string equality condition", () => {
    const program = parsePfScript(`if currentPhoneme == "A" then
    MouthA = 1
end`);
    const stmt = program.body[0];
    if (stmt?.type === "If") {
      expect(stmt.condition.type).toBe("Binary");
      if (stmt.condition.type === "Binary") {
        expect(stmt.condition.op).toBe("==");
        expect(stmt.condition.right.type).toBe("String");
      }
    }
  });

  it("parses logical and/or/not", () => {
    const program = parsePfScript("flag = not speaking and volume > 0.1 or true");
    expect(program.body[0]?.type).toBe("Assign");
  });

  it("parses comparison operators", () => {
    parsePfScript("a = x != 1");
    parsePfScript("a = x >= 1");
    parsePfScript("a = x <= 1");
    parsePfScript("a = x > 1");
    parsePfScript("a = x < 1");
  });

  it("parses boolean literals", () => {
    const program = parsePfScript("speaking = true");
    expect(program.body[0]).toMatchObject({
      type: "Assign",
      value: { type: "Boolean", value: true },
    });
  });

  it("parses clamp call", () => {
    const program = parsePfScript("smile = clamp(interest, 0, 1)");
    expect(program.body[0]?.type).toBe("Assign");
  });

  it("parses eventActive call in condition", () => {
    const program = parsePfScript(`if eventActive("blink") then
    eyeOpen = 0
end`);
    expect(program.body[0]?.type).toBe("If");
  });

  it("parses blink() with no args", () => {
    const program = parsePfScript("blink()");
    expect(program.body[0]?.type).toBe("CallStmt");
  });

  it("parses spec sample document", () => {
    const program = parsePfScript(SPEC_SAMPLE_PFSCRIPT);
    expect(program.body.length).toBeGreaterThanOrEqual(6);
    expect(program.body.some((stmt) => stmt.type === "If")).toBe(true);
    expect(containsCallStmt(program.body)).toBe(true);
  });

  it("preserves custom motion identifier casing", () => {
    const program = parsePfScript("MouthA = 1");
    expect(program.body[0]).toMatchObject({ type: "Assign", target: "MouthA" });
  });

  it("parses parentheses in expressions", () => {
    const program = parsePfScript("a = (interest + 1) * 2");
    expect(program.body[0]?.type).toBe("Assign");
  });

  it("parses unary minus", () => {
    const program = parsePfScript("a = -interest");
    expect(program.body[0]).toMatchObject({
      type: "Assign",
      value: { type: "Unary", op: "-" },
    });
  });

  it("parses modulo operator", () => {
    parsePfScript("a = interest % 2");
  });

  it("parses division operator", () => {
    parsePfScript("a = interest / 2");
  });

  it("rejects while keyword", () => {
    expect(() => parsePfScript("while true do end")).toThrow(PfScriptParseError);
  });

  it("rejects for keyword", () => {
    expect(() => parsePfScript("for i = 1, 10 do end")).toThrow(PfScriptParseError);
  });

  it("rejects goto keyword", () => {
    expect(() => parsePfScript("goto skip")).toThrow(PfScriptParseError);
  });

  it("rejects require keyword", () => {
    expect(() => parsePfScript("require('mod')")).toThrow(PfScriptParseError);
  });

  it("rejects repeat keyword", () => {
    expect(() => parsePfScript("repeat until true")).toThrow(PfScriptParseError);
  });

  it("rejects os member access", () => {
    expect(() => parsePfScript("os.execute('rm')")).toThrow(PfScriptForbiddenError);
  });

  it("rejects io member access", () => {
    expect(() => parsePfScript("io.open('x')")).toThrow(PfScriptForbiddenError);
  });

  it("rejects debug member access", () => {
    expect(() => parsePfScript("debug.trace()")).toThrow(PfScriptForbiddenError);
  });

  it("rejects generic member access", () => {
    expect(() => parsePfScript("a = foo.bar")).toThrow(PfScriptParseError);
  });

  it("rejects unterminated string", () => {
    expect(() => parsePfScript('a = "oops')).toThrow(PfScriptParseError);
  });

  it("rejects missing end", () => {
    expect(() => parsePfScript("if true then smile = 1")).toThrow(PfScriptParseError);
  });

  it("rejects unexpected token", () => {
    expect(() => parsePfScript("@invalid = 1")).toThrow(PfScriptParseError);
  });
});
