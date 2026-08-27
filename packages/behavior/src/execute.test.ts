import { ChannelStore, DEFAULT_MOTION_STATE, StateStore } from "@puppetflow/core";
import {
  createDefaultStatefulRegistry,
  createStatefulRegistry,
  StatefulStore,
} from "@puppetflow/stateful-core";
import { describe, expect, it } from "vitest";
import type { BehaviorBlock } from "./ast.js";
import { executeBehavior, executeBehaviorWithInvocations } from "./execute.js";
import type { BehaviorExecutionContext } from "./context.js";

function createCtx(
  overrides: Partial<BehaviorExecutionContext> = {},
): BehaviorExecutionContext {
  const store = overrides.statefulStore ?? new StatefulStore();
  return {
    state: overrides.state ?? new StateStore(),
    channels: overrides.channels ?? new ChannelStore(),
    renderedMotion: DEFAULT_MOTION_STATE,
    deltaTime: overrides.deltaTime ?? 1 / 60,
    time: overrides.time ?? 0,
    frame: overrides.frame ?? {
      deltaTime: overrides.deltaTime ?? 1 / 60,
      frameNumber: 0,
      elapsedTime: overrides.time ?? 0,
    },
    statefulStore: store,
    statefulRegistry: overrides.statefulRegistry ?? createDefaultStatefulRegistry(),
    activeTimelineEvents: overrides.activeTimelineEvents ?? [],
    ...overrides,
  };
}

describe("executeBehavior", () => {
  it("runs If with Assign", () => {
    const state = new StateStore();
    state.set("interest", 0.8);

    const root: BehaviorBlock = {
      type: "Block",
      statements: [
        {
          type: "If",
          condition: { left: "interest", op: ">", right: 0.7 },
          then: [{ type: "Assign", key: "mouthX", op: "add", value: 0.2 }],
        },
      ],
    };

    const output = executeBehavior(root, createCtx({ state }));

    expect(output.mouthX).toBeCloseTo(0.2, 3);
  });

  it("evaluates numeric If conditions using channels", () => {
    const channels = new ChannelStore();
    channels.set("volume", 0.8);

    const root: BehaviorBlock = {
      type: "Block",
      statements: [
        {
          type: "If",
          condition: { left: "volume", op: ">", right: 0.5 },
          then: [
            {
              type: "ExprAssign",
              target: "mouthX",
              value: { type: "Number", value: 1 },
            },
          ],
        },
      ],
    };

    const output = executeBehavior(root, createCtx({ channels }));
    expect(output.mouthX).toBeCloseTo(1, 3);
  });

  it("collects MotionPack invocations only from executed branches", () => {
    const state = new StateStore();
    state.set("interest", 0.5);

    const root: BehaviorBlock = {
      type: "Block",
      statements: [
        {
          type: "If",
          condition: { left: "interest", op: ">", right: 0.7 },
          then: [
            { type: "MotionPack", packId: "thinking", config: { intensity: 0.8 } },
          ],
          else: [{ type: "MotionPack", packId: "idle", config: { strength: 0.3 } }],
        },
      ],
    };

    const falseBranch = executeBehaviorWithInvocations(root, createCtx({ state }));
    expect(falseBranch.packInvocations).toEqual([
      { packId: "idle", config: { strength: 0.3 } },
    ]);

    state.set("interest", 0.9);
    const trueBranch = executeBehaviorWithInvocations(root, createCtx({ state }));
    expect(trueBranch.packInvocations).toEqual([
      { packId: "thinking", config: { intensity: 0.8 } },
    ]);
  });

  it("evaluates dynamic Pack config expressions in the executed branch", () => {
    const result = executeBehaviorWithInvocations(
      {
        type: "Block",
        statements: [
          {
            type: "LocalLet",
            name: "intensity",
            value: { type: "Number", value: 0.6 },
          },
          {
            type: "MotionPack",
            packId: "thinking",
            configExpressions: {
              intensity: { type: "Identifier", name: "intensity" },
            },
          },
        ],
      },
      createCtx(),
    );

    expect(result.packInvocations).toEqual([
      { packId: "thinking", config: { intensity: 0.6 } },
    ]);
  });

  it("evaluates nested stateful Pack config call arguments once", () => {
    let updates = 0;
    const statefulRegistry = createStatefulRegistry();
    statefulRegistry.register({
      name: "counter",
      createState: () => 0,
      update: (_frame, state) => {
        updates += 1;
        const value = state + 1;
        return { value, state: value };
      },
    });

    const result = executeBehaviorWithInvocations(
      {
        type: "Block",
        statements: [
          {
            type: "MotionPack",
            packId: "thinking",
            configExpressions: {
              intensity: {
                type: "Call",
                callee: "abs",
                args: [
                  {
                    name: "value",
                    value: { type: "Call", callee: "counter", args: [] },
                  },
                ],
              },
            },
          },
        ],
      },
      createCtx({ statefulRegistry }),
    );

    expect(updates).toBe(1);
    expect(result.packInvocations).toEqual([
      { packId: "thinking", config: { intensity: 1 } },
    ]);
  });

  it("uses the last assignment when the same key is assigned multiple times", () => {
    const root: BehaviorBlock = {
      type: "Block",
      statements: [
        {
          type: "ExprAssign",
          target: "mouthX",
          value: { type: "Number", value: 0.2 },
        },
        {
          type: "ExprAssign",
          target: "mouthX",
          value: { type: "Number", value: 0.8 },
        },
      ],
    };

    const output = executeBehavior(root, createCtx());

    expect(output.mouthX).toBeCloseTo(0.8, 3);
  });

  it("evaluates Expr conditions with stateful cooldown", () => {
    const store = new StatefulStore();
    const root: BehaviorBlock = {
      type: "Block",
      statements: [
        {
          type: "If",
          condition: {
            kind: "Expr",
            expression: {
              type: "Call",
              callee: "cooldown",
              args: [
                { name: "id", value: { type: "String", value: "blink" } },
                { name: "duration", value: { type: "Number", value: 10 } },
              ],
            },
          },
          then: [
            {
              type: "ExprAssign",
              target: "eyeYaw",
              value: { type: "Number", value: 0.2 },
            },
          ],
        },
      ],
    };

    const allowed = executeBehavior(
      root,
      createCtx({
        statefulStore: store,
        time: 0,
        frame: { deltaTime: 1 / 60, frameNumber: 0, elapsedTime: 0 },
      }),
    );
    const blocked = executeBehavior(
      root,
      createCtx({
        statefulStore: store,
        time: 1 / 60,
        frame: { deltaTime: 1 / 60, frameNumber: 1, elapsedTime: 1 / 60 },
      }),
    );

    expect(allowed.eyeYaw).toBeCloseTo(0.2, 3);
    expect(blocked.eyeYaw).toBeUndefined();
  });

  it("uses a local value without emitting a custom key", () => {
    const output = executeBehavior(
      {
        type: "Block",
        statements: [
          { type: "LocalLet", name: "target", value: { type: "Number", value: 0.2 } },
          {
            type: "LocalAssign",
            name: "target",
            value: { type: "Number", value: 0.5 },
          },
          {
            type: "ExprAssign",
            target: "mouthX",
            value: { type: "Identifier", name: "target" },
          },
        ],
      },
      createCtx(),
    );

    expect(output.mouthX).toBeCloseTo(0.5, 3);
    expect(output.custom?.target).toBeUndefined();
  });

  it("pops branch locals and updates an outer local", () => {
    const state = new StateStore();
    state.set("interest", 0.8);
    state.set("branchOnly", 0.6);
    const output = executeBehavior(
      {
        type: "Block",
        statements: [
          { type: "LocalLet", name: "value", value: { type: "Number", value: 0.2 } },
          {
            type: "If",
            condition: { left: "interest", op: ">", right: 0.5 },
            then: [
              {
                type: "LocalLet",
                name: "branchOnly",
                value: { type: "Number", value: 0.1 },
              },
              {
                type: "LocalAssign",
                name: "value",
                value: { type: "Number", value: 0.8 },
              },
            ],
          },
          {
            type: "ExprAssign",
            target: "mouthX",
            value: { type: "Identifier", name: "value" },
          },
          {
            type: "ExprAssign",
            target: "mouthY",
            value: { type: "Identifier", name: "branchOnly" },
          },
        ],
      },
      createCtx({ state }),
    );

    expect(output.mouthX).toBeCloseTo(0.8, 3);
    expect(output.mouthY).toBeCloseTo(0.6, 3);
  });

  it("supports same-block rebinding and nested shadowing", () => {
    const output = executeBehavior(
      {
        type: "Block",
        statements: [
          { type: "LocalLet", name: "value", value: { type: "Number", value: 0.2 } },
          { type: "LocalLet", name: "value", value: { type: "Number", value: 0.4 } },
          {
            type: "If",
            condition: { kind: "Expr", expression: { type: "Boolean", value: true } },
            then: [
              {
                type: "LocalLet",
                name: "value",
                value: { type: "Number", value: 0.8 },
              },
              {
                type: "ExprAssign",
                target: "mouthY",
                value: { type: "Identifier", name: "value" },
              },
            ],
          },
          {
            type: "ExprAssign",
            target: "mouthX",
            value: { type: "Identifier", name: "value" },
          },
        ],
      },
      createCtx(),
    );

    expect(output.mouthX).toBeCloseTo(0.4, 3);
    expect(output.mouthY).toBeCloseTo(0.8, 3);
  });

  it("falls back to State/Channel resolution before a later declaration", () => {
    const state = new StateStore();
    state.set("value", 0.7);
    const output = executeBehavior(
      {
        type: "Block",
        statements: [
          {
            type: "ExprAssign",
            target: "mouthX",
            value: { type: "Identifier", name: "value" },
          },
          { type: "LocalLet", name: "value", value: { type: "Number", value: 0.2 } },
        ],
      },
      createCtx({ state }),
    );

    expect(output.mouthX).toBeCloseTo(0.7, 3);
  });

  it("does not retain locals between behavior executions", () => {
    const firstOutput = executeBehavior(
      {
        type: "Block",
        statements: [
          { type: "LocalLet", name: "value", value: { type: "Number", value: 0.8 } },
          {
            type: "ExprAssign",
            target: "mouthX",
            value: { type: "Identifier", name: "value" },
          },
        ],
      },
      createCtx(),
    );

    const state = new StateStore();
    state.set("value", 0.3);
    const secondOutput = executeBehavior(
      {
        type: "Block",
        statements: [
          {
            type: "ExprAssign",
            target: "mouthX",
            value: { type: "Identifier", name: "value" },
          },
        ],
      },
      createCtx({ state }),
    );

    expect(firstOutput.mouthX).toBeCloseTo(0.8, 3);
    expect(secondOutput.mouthX).toBeCloseTo(0.3, 3);
  });

  it("rejects assignment to an undeclared local", () => {
    expect(() =>
      executeBehavior(
        {
          type: "Block",
          statements: [
            {
              type: "LocalAssign",
              name: "target",
              value: { type: "Number", value: 0.5 },
            },
          ],
        },
        createCtx(),
      ),
    ).toThrow(/LocalAssign cannot update undeclared local "target"/);
  });
});
