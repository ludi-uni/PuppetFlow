import { describe, expect, it } from "vitest";
import type { BehaviorBlock } from "./ast.js";
import { collectBehaviorCustomMotionKeys } from "./collect-custom-keys.js";

describe("collectBehaviorCustomMotionKeys", () => {
  it("collects custom keys from ExprAssign targets", () => {
    const behavior: BehaviorBlock = {
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
        {
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
        },
      ],
    };

    expect(collectBehaviorCustomMotionKeys(behavior)).toEqual(["MouthA", "MouthI"]);
  });

  it("ignores standard motion keys", () => {
    const behavior: BehaviorBlock = {
      type: "Block",
      statements: [
        {
          type: "ExprAssign",
          target: "mouthX",
          value: { type: "Number", value: 0.5 },
        },
      ],
    };

    expect(collectBehaviorCustomMotionKeys(behavior)).toEqual([]);
  });
});
