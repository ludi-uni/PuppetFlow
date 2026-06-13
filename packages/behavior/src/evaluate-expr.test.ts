import { ChannelStore, DEFAULT_MOTION_STATE, StateStore } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import { executeBehavior } from "./execute.js";
import { evaluateExpressionAsNumber } from "./evaluate-expr.js";
import type { BehaviorExecutionContext } from "./context.js";

function createContext(overrides: Partial<BehaviorExecutionContext> = {}): BehaviorExecutionContext {
  return {
    state: new StateStore(),
    channels: new ChannelStore(),
    renderedMotion: DEFAULT_MOTION_STATE,
    deltaTime: 0.016,
    ...overrides,
  };
}

describe("evaluateExpressionAsNumber", () => {
  it("evaluates math and trig builtins", () => {
    const ctx = createContext();

    expect(
      evaluateExpressionAsNumber(
        {
          type: "Call",
          callee: "clamp",
          args: [
            { value: { type: "Number", value: 1.5 } },
            { value: { type: "Number", value: 0 } },
            { value: { type: "Number", value: 1 } },
          ],
        },
        ctx,
      ),
    ).toBe(1);
  });

  it("evaluates eventActive from timeline events", () => {
    const ctx = createContext({
      activeTimelineEvents: [{ startMs: 0, endMs: 100, type: "blink", value: {} }],
    });

    expect(
      evaluateExpressionAsNumber(
        {
          type: "Call",
          callee: "eventActive",
          args: [{ value: { type: "String", value: "blink" } }],
        },
        ctx,
      ),
    ).toBe(1);
  });

  it("reads state, channels, and time", () => {
    const state = new StateStore();
    state.set("interest", 0.8);
    const channels = new ChannelStore();
    channels.set("volume", 0.6);

    const ctx = createContext({ state, channels, time: 2 });

    expect(
      evaluateExpressionAsNumber(
        { type: "Identifier", name: "interest" },
        ctx,
      ),
    ).toBe(0.8);
    expect(
      evaluateExpressionAsNumber(
        { type: "Identifier", name: "volume" },
        ctx,
      ),
    ).toBe(0.6);
    expect(
      evaluateExpressionAsNumber(
        { type: "Identifier", name: "time" },
        ctx,
      ),
    ).toBe(2);
  });
});

describe("executeBehavior PFScript outputs", () => {
  it("applies ExprAssign with aliases and custom keys", () => {
    const state = new StateStore();
    state.set("interest", 1);
    const channels = new ChannelStore();
    channels.set("volume", 0.5);

    const output = executeBehavior(
      {
        type: "Block",
        statements: [
          {
            type: "ExprAssign",
            target: "mouthX",
            value: {
              type: "Binary",
              op: "*",
              left: { type: "Identifier", name: "interest" },
              right: { type: "Number", value: 0.4 },
            },
          },
          {
            type: "ExprAssign",
            target: "mouthY",
            value: { type: "Identifier", name: "volume" },
          },
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
      },
      createContext({ state, channels, currentPhoneme: "A" }),
    );

    expect(output.mouthX).toBeCloseTo(0.4, 3);
    expect(output.mouthY).toBeCloseTo(0.5, 3);
    expect(output.custom?.MouthA).toBeCloseTo(1, 3);
  });
});
