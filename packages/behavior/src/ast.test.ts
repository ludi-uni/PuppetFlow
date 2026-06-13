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
});
