import { describe, expect, it } from "vitest";
import { parseBehaviorRoot } from "./ast.js";

describe("parseBehaviorRoot", () => {
  it("accepts valid behavior trees", () => {
    const root = parseBehaviorRoot({
      type: "Block",
      statements: [
        {
          type: "If",
          condition: { left: "interest", op: ">", right: 0.5 },
          then: [{ type: "Assign", key: "mouthX", op: "set", value: 0.3 }],
        },
      ],
    });

    expect(root.statements).toHaveLength(1);
  });

  it("rejects Builtin statements", () => {
    expect(() =>
      parseBehaviorRoot({
        type: "Block",
        statements: [
          { type: "Builtin", id: "gaze", config: { wanderAmplitude: 0.04 } },
        ],
      }),
    ).toThrow(/Builtin/i);
  });

  it("rejects unknown statement types", () => {
    expect(() =>
      parseBehaviorRoot({
        type: "Block",
        statements: [{ type: "Unknown", value: 1 }],
      }),
    ).toThrow(/unsupported behavior statement/i);
  });

  it("accepts StringCompare and ExprAssign statements", () => {
    const root = parseBehaviorRoot({
      type: "Block",
      statements: [
        {
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
        },
      ],
    });

    expect(root.statements[0]?.type).toBe("If");
  });

  it("rejects invalid Assign keys", () => {
    expect(() =>
      parseBehaviorRoot({
        type: "Block",
        statements: [{ type: "Assign", key: "notAKey", op: "set", value: 1 }],
      }),
    ).toThrow(/invalid Assign statement/i);
  });

  it("parses local Behavior statements from serialized JSON", () => {
    expect(
      parseBehaviorRoot({
        type: "Block",
        statements: [
          { type: "LocalLet", name: "target", value: { type: "Number", value: 0.2 } },
          {
            type: "LocalAssign",
            name: "target",
            value: { type: "Identifier", name: "volume" },
          },
        ],
      }),
    ).toEqual({
      type: "Block",
      statements: [
        { type: "LocalLet", name: "target", value: { type: "Number", value: 0.2 } },
        {
          type: "LocalAssign",
          name: "target",
          value: { type: "Identifier", name: "volume" },
        },
      ],
    });
  });

  it("rejects a serialized Pack that contains both config forms", () => {
    expect(() =>
      parseBehaviorRoot({
        type: "Block",
        statements: [
          {
            type: "MotionPack",
            packId: "thinking",
            config: { intensity: 0.8 },
            configExpressions: {
              intensity: { type: "Number", value: 0.8 },
            },
          },
        ],
      }),
    ).toThrow(/config.*configExpressions/i);
  });

  it("preserves JSON-originated Pack config records with null prototypes", () => {
    const root = parseBehaviorRoot(
      JSON.parse(`{
        "type": "Block",
        "statements": [
          {
            "type": "MotionPack",
            "packId": "literal",
            "config": { "__proto__": 0.2, "constructor": 0.4 }
          },
          {
            "type": "MotionPack",
            "packId": "expression",
            "configExpressions": {
              "__proto__": { "type": "Number", "value": 0.6 },
              "toString": { "type": "Number", "value": 0.8 }
            }
          }
        ]
      }`),
    );
    const [literalPack, expressionPack] = root.statements;

    expect(literalPack).toMatchObject({ type: "MotionPack", packId: "literal" });
    expect(expressionPack).toMatchObject({ type: "MotionPack", packId: "expression" });
    if (
      literalPack?.type !== "MotionPack" ||
      !literalPack.config ||
      expressionPack?.type !== "MotionPack" ||
      !expressionPack.configExpressions
    ) {
      throw new Error("expected normalized MotionPack config records");
    }

    expect(Object.getPrototypeOf(literalPack.config)).toBeNull();
    expect(Object.hasOwn(literalPack.config, "__proto__")).toBe(true);
    expect(literalPack.config.__proto__).toBeCloseTo(0.2, 3);
    expect(literalPack.config.constructor).toBeCloseTo(0.4, 3);
    expect(Object.getPrototypeOf(expressionPack.configExpressions)).toBeNull();
    expect(Object.hasOwn(expressionPack.configExpressions, "__proto__")).toBe(true);
    expect(expressionPack.configExpressions.__proto__).toEqual({
      type: "Number",
      value: 0.6,
    });
    expect(expressionPack.configExpressions.toString).toEqual({
      type: "Number",
      value: 0.8,
    });
  });
});
