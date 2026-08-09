import { describe, expect, it } from "vitest";
import {
  createMotionFrameGraphController,
  type MotionFrameGraphEvaluationContext,
  type MotionFrameGraphDocument,
} from "./index.js";

const document: MotionFrameGraphDocument = {
  version: 1,
  initialState: "idle",
  states: [
    { id: "idle", sources: { idle: { enabled: true, priority: 10 } } },
    {
      id: "tracking",
      sources: { idle: { enabled: false }, tracker: { enabled: true, priority: 100 } },
    },
    { id: "fallback", sources: { fallback: { enabled: true } } },
  ],
  transitions: [
    {
      from: "idle",
      to: "tracking",
      when: { type: "signal", key: "tracking", operator: "equals", value: true },
    },
    {
      from: "tracking",
      to: "fallback",
      when: { type: "source", sourceId: "tracker", field: "stale", equals: true },
    },
    {
      from: "tracking",
      to: "idle",
      when: { type: "elapsed", minimumMs: 1000 },
    },
  ],
};

describe("createMotionFrameGraphController", () => {
  it("evaluates signal, source, elapsed, and reset transitions with an injected clock", () => {
    let time = 100;
    const controller = createMotionFrameGraphController(document, { now: () => time });

    expect(controller.snapshot()).toEqual({
      stateId: "idle",
      enteredAt: 100,
      policy: { idle: { enabled: true, priority: 10 } },
    });

    controller.setSignal("tracking", true);
    expect(controller.evaluate({ sources: {} }).stateId).toBe("tracking");

    time = 250;
    expect(
      controller.evaluate({
        sources: { tracker: { connected: false, stale: true } },
      }).stateId,
    ).toBe("fallback");

    time = 500;
    controller.reset();
    expect(controller.snapshot()).toEqual({
      stateId: "idle",
      enteredAt: 500,
      policy: { idle: { enabled: true, priority: 10 } },
    });
    expect(controller.evaluate({ sources: {} }).stateId).toBe("idle");
  });

  it("treats undefined signals and unknown sources as false", () => {
    const controller = createMotionFrameGraphController({
      ...document,
      transitions: [
        {
          from: "idle",
          to: "tracking",
          when: { type: "signal", key: "missing", operator: "equals", value: true },
        },
        {
          from: "idle",
          to: "fallback",
          when: {
            type: "source",
            sourceId: "missing",
            field: "connected",
            equals: true,
          },
        },
      ],
    });

    expect(controller.evaluate({ sources: {} }).stateId).toBe("idle");
  });

  it("requires finite numeric values for numeric signal operators", () => {
    const controller = createMotionFrameGraphController({
      ...document,
      transitions: [
        {
          from: "idle",
          to: "tracking",
          when: { type: "signal", key: "value", operator: "gte", value: 1 },
        },
      ],
    });

    controller.setSignal("value", "1");
    expect(controller.evaluate({ sources: {} }).stateId).toBe("idle");
  });

  it("uses state-entry time for elapsed conditions", () => {
    let time = 100;
    const controller = createMotionFrameGraphController(
      {
        ...document,
        transitions: [
          {
            from: "idle",
            to: "tracking",
            when: { type: "elapsed", minimumMs: 100 },
          },
          {
            from: "tracking",
            to: "fallback",
            when: { type: "elapsed", minimumMs: 100 },
          },
        ],
      },
      { now: () => time },
    );

    time = 200;
    expect(controller.evaluate({ sources: {} }).stateId).toBe("tracking");
    time = 299;
    expect(controller.evaluate({ sources: {} }).stateId).toBe("tracking");
    time = 300;
    expect(controller.evaluate({ sources: {} }).stateId).toBe("fallback");
  });

  it("applies only the first matching transition in document order", () => {
    const controller = createMotionFrameGraphController({
      ...document,
      transitions: [
        {
          from: "idle",
          to: "tracking",
          when: { type: "signal", key: "go", operator: "equals", value: true },
        },
        {
          from: "idle",
          to: "fallback",
          when: { type: "signal", key: "go", operator: "equals", value: true },
        },
        {
          from: "tracking",
          to: "fallback",
          when: { type: "signal", key: "go", operator: "equals", value: true },
        },
      ],
    });

    controller.setSignal("go", true);
    expect(controller.evaluate({ sources: {} }).stateId).toBe("tracking");
  });

  it("returns defensive snapshot clones and rejects empty signal keys", () => {
    const controller = createMotionFrameGraphController(document);
    const snapshot = controller.snapshot();

    snapshot.policy.idle!.enabled = false;
    expect(controller.snapshot().policy.idle!.enabled).toBe(true);
    expect(() => controller.setSignal("  ", true)).toThrow(
      "Motion graph signal key must be non-empty",
    );
  });

  it("treats missing source-health fields as false", () => {
    const controller = createMotionFrameGraphController({
      ...document,
      transitions: [
        {
          from: "idle",
          to: "tracking",
          when: {
            type: "source",
            sourceId: "tracker",
            field: "connected",
            equals: true,
          },
        },
      ],
    });

    expect(
      controller.evaluate({
        sources: { tracker: { stale: false } },
      } as unknown as MotionFrameGraphEvaluationContext).stateId,
    ).toBe("idle");
  });
});
