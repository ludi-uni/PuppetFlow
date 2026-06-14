import { ChannelStore, DEFAULT_MOTION_STATE, StateStore } from "@puppetflow/core";
import { createDefaultStatefulRegistry, StatefulStore } from "@puppetflow/stateful-core";
import { describe, expect, it } from "vitest";
import { evaluateExpressionAsNumber } from "./evaluate-expr.js";
import type { BehaviorExecutionContext } from "./context.js";

function createCtx(
  store: StatefulStore,
  frameNumber: number,
): BehaviorExecutionContext {
  const state = new StateStore();
  state.set("interest", 0.2);
  return {
    state,
    channels: new ChannelStore(),
    renderedMotion: DEFAULT_MOTION_STATE,
    deltaTime: 1 / 60,
    time: frameNumber / 60,
    frame: {
      deltaTime: 1 / 60,
      frameNumber,
      elapsedTime: frameNumber / 60,
    },
    statefulStore: store,
    statefulRegistry: createDefaultStatefulRegistry(),
  };
}

describe("stateful PFScript calls", () => {
  it("evaluates oscillator with named args", () => {
    const store = new StatefulStore();
    const ctx = createCtx(store, 0);

    const value = evaluateExpressionAsNumber(
      {
        type: "Call",
        callee: "oscillator",
        args: [
          { name: "id", value: { type: "String", value: "body" } },
          { name: "frequency", value: { type: "Number", value: 0.5 } },
        ],
      },
      ctx,
    );

    expect(value).toBeGreaterThanOrEqual(-1);
    expect(value).toBeLessThanOrEqual(1);
  });

  it("smooth eases toward the value argument", () => {
    const store = new StatefulStore();
    let latest = 0;

    for (let frame = 0; frame < 90; frame++) {
      latest = evaluateExpressionAsNumber(
        {
          type: "Call",
          callee: "smooth",
          args: [
            { name: "id", value: { type: "String", value: "interest" } },
            { name: "value", value: { type: "Identifier", name: "interest" } },
            { name: "speed", value: { type: "Number", value: 3 } },
          ],
        },
        createCtx(store, frame),
      );
    }

    expect(latest).toBeGreaterThan(0.15);
    expect(latest).toBeLessThan(0.25);
  });

  it("evaluates spring toward a target identifier", () => {
    const store = new StatefulStore();
    let latest = 0;

    for (let frameNumber = 0; frameNumber < 120; frameNumber++) {
      latest = evaluateExpressionAsNumber(
        {
          type: "Call",
          callee: "spring",
          args: [
            { name: "id", value: { type: "String", value: "ear" } },
            { name: "target", value: { type: "Identifier", name: "interest" } },
          ],
        },
        createCtx(store, frameNumber),
      );
    }

    expect(latest).toBeGreaterThan(0.1);
    expect(latest).toBeLessThan(0.3);
  });

  it("evaluates randomHold with interval bounds", () => {
    const store = new StatefulStore();
    const value = evaluateExpressionAsNumber(
      {
        type: "Call",
        callee: "randomHold",
        args: [
          { name: "id", value: { type: "String", value: "look" } },
          { name: "interval", value: { type: "Number", value: 2 } },
          { name: "min", value: { type: "Number", value: -0.2 } },
          { name: "max", value: { type: "Number", value: 0.2 } },
        ],
      },
      createCtx(store, 0),
    );

    expect(value).toBeGreaterThanOrEqual(-0.2);
    expect(value).toBeLessThanOrEqual(0.2);
  });

  it("evaluates breath and wander generators", () => {
    const store = new StatefulStore();
    const breath = evaluateExpressionAsNumber(
      {
        type: "Call",
        callee: "breath",
        args: [
          { name: "id", value: { type: "String", value: "chest" } },
          { name: "rate", value: { type: "Number", value: 0.25 } },
        ],
      },
      createCtx(store, 10),
    );
    const wander = evaluateExpressionAsNumber(
      {
        type: "Call",
        callee: "wander",
        args: [
          { name: "id", value: { type: "String", value: "lookX" } },
          { name: "speed", value: { type: "Number", value: 0.2 } },
        ],
      },
      createCtx(store, 20),
    );

    expect(breath).toBeGreaterThan(0);
    expect(breath).toBeLessThanOrEqual(1);
    expect(wander).toBeGreaterThan(-1.5);
    expect(wander).toBeLessThan(1.5);
  });
});
