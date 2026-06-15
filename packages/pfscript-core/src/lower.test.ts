import { describe, expect, it } from "vitest";
import { parsePfScript } from "./parser.js";
import { SPEC_SAMPLE_PFSCRIPT } from "./samples.js";
import { lowerPfScriptToBehavior } from "./lower.js";

describe("lowerPfScriptToBehavior", () => {
  it("lowers the spec sample to a behavior block", () => {
    const program = parsePfScript(SPEC_SAMPLE_PFSCRIPT);
    const behavior = lowerPfScriptToBehavior(program);

    expect(behavior.type).toBe("Block");
    expect(behavior.statements).toHaveLength(6);

    expect(behavior.statements[0]).toEqual({
      type: "ExprAssign",
      target: "mouthX",
      value: {
        type: "Binary",
        op: "*",
        left: { type: "Identifier", name: "interest" },
        right: { type: "Number", value: 0.4 },
      },
    });

    expect(behavior.statements[1]).toEqual({
      type: "ExprAssign",
      target: "mouthY",
      value: { type: "Identifier", name: "volume" },
    });

    expect(behavior.statements[2]).toEqual({
      type: "ExprAssign",
      target: "headTilt",
      value: {
        type: "Binary",
        op: "*",
        left: {
          type: "Call",
          callee: "noise",
          args: [
            {
              value: {
                type: "Binary",
                op: "*",
                left: { type: "Identifier", name: "time" },
                right: { type: "Number", value: 0.2 },
              },
            },
          ],
        },
        right: { type: "Number", value: 0.1 },
      },
    });

    const thinkingIf = behavior.statements[3];
    expect(thinkingIf).toMatchObject({
      type: "If",
      condition: { left: "interest", op: ">", right: 0.7 },
      then: [
        {
          type: "MotionPack",
          packId: "thinking",
          config: { intensity: 0.8 },
        },
      ],
    });

    expect(behavior.statements[4]).toEqual({
      type: "If",
      condition: {
        kind: "StringCompare",
        left: "currentPhoneme",
        op: "==",
        right: "A",
      },
      then: [
        {
          type: "ExprAssign",
          target: "custom:MouthA",
          value: { type: "Number", value: 1 },
        },
      ],
      else: undefined,
    });

    expect(behavior.statements[5]).toEqual({
      type: "If",
      condition: {
        kind: "StringCompare",
        left: "currentPhoneme",
        op: "==",
        right: "I",
      },
      then: [
        {
          type: "ExprAssign",
          target: "custom:MouthI",
          value: { type: "Number", value: 1 },
        },
      ],
      else: undefined,
    });
  });

  it("lowers elseif chains to nested If statements", () => {
    const program = parsePfScript(`
if interest > 0.8 then
    smile = 0.5
elseif interest > 0.5 then
    smile = 0.3
else
    smile = 0.1
end
`);
    const behavior = lowerPfScriptToBehavior(program);
    const rootIf = behavior.statements[0];

    expect(rootIf).toMatchObject({
      type: "If",
      condition: { left: "interest", op: ">", right: 0.8 },
    });

    if (rootIf.type !== "If") {
      throw new Error("expected If");
    }

    expect(rootIf.else).toHaveLength(1);
    const elseIf = rootIf.else?.[0];
    expect(elseIf).toMatchObject({
      type: "If",
      condition: { left: "interest", op: ">", right: 0.5 },
    });

    if (!elseIf || elseIf.type !== "If") {
      throw new Error("expected nested If");
    }

    expect(elseIf.else).toHaveLength(1);
    const finalElse = elseIf.else?.[0];
    expect(finalElse).toMatchObject({
      type: "ExprAssign",
      target: "mouthX",
      value: { type: "Number", value: 0.1 },
    });
  });

  it("lowers logical and/or conditions", () => {
    const program = parsePfScript(`
if interest > 0.5 and volume > 0.2 then
    smile = 1
end
`);
    const behavior = lowerPfScriptToBehavior(program);
    const rootIf = behavior.statements[0];

    expect(rootIf).toMatchObject({
      type: "If",
      condition: {
        type: "And",
        conditions: [
          { left: "interest", op: ">", right: 0.5 },
          { left: "volume", op: ">", right: 0.2 },
        ],
      },
    });
  });

  it("lowers call expression conditions", () => {
    const program = parsePfScript(`if cooldown(id = "blink", duration = 3.0) then
    eyeYaw = 0.2
end`);
    const behavior = lowerPfScriptToBehavior(program);
    const rootIf = behavior.statements[0];

    expect(rootIf).toMatchObject({
      type: "If",
      condition: {
        kind: "Expr",
        expression: { type: "Call", callee: "cooldown" },
      },
    });
  });

  it("lowers numeric compare with call expression on the left", () => {
    const program =
      parsePfScript(`if randomHold(id = "mouth-toggle", interval = 1.5, min = 0, max = 1) >= 0.5 then
    mouthX = 1
else
    mouthX = 0
end`);
    const behavior = lowerPfScriptToBehavior(program);
    const rootIf = behavior.statements[0];

    expect(rootIf).toMatchObject({
      type: "If",
      condition: {
        kind: "Expr",
        expression: {
          type: "Binary",
          op: ">=",
          left: { type: "Call", callee: "randomHold" },
          right: { type: "Number", value: 0.5 },
        },
      },
    });
  });

  it("lowers numeric compare with expressions on both sides", () => {
    const program = parsePfScript(`if interest * 0.5 > volume then
    mouthX = 1
end`);
    const behavior = lowerPfScriptToBehavior(program);
    const rootIf = behavior.statements[0];

    expect(rootIf).toMatchObject({
      type: "If",
      condition: {
        kind: "Expr",
        expression: {
          type: "Binary",
          op: ">",
          left: {
            type: "Binary",
            op: "*",
            left: { type: "Identifier", name: "interest" },
            right: { type: "Number", value: 0.5 },
          },
          right: { type: "Identifier", name: "volume" },
        },
      },
    });
  });

  it("lowers numeric compare with a literal on the left", () => {
    const program =
      parsePfScript(`if 0.5 <= randomHold(id = "mouth-toggle", interval = 1.5, min = 0, max = 1) then
    mouthX = 1
end`);
    const behavior = lowerPfScriptToBehavior(program);
    const rootIf = behavior.statements[0];

    expect(rootIf).toMatchObject({
      type: "If",
      condition: {
        kind: "Expr",
        expression: {
          type: "Binary",
          op: "<=",
          left: { type: "Number", value: 0.5 },
          right: { type: "Call", callee: "randomHold" },
        },
      },
    });
  });
});

describe("motion aliases", () => {
  it("maps smile and mouthOpen to standard keys", () => {
    const program = parsePfScript(`
smile = 0.2
mouthOpen = 0.3
`);
    const behavior = lowerPfScriptToBehavior(program);

    expect(behavior.statements[0]).toMatchObject({ target: "mouthX" });
    expect(behavior.statements[1]).toMatchObject({ target: "mouthY" });
  });
});
