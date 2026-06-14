import { ChannelStore, StateStore, TimelineStore } from "@puppetflow/core";
import { createDefaultStatefulRegistry, StatefulStore } from "@puppetflow/stateful-core";
import { describe, expect, it } from "vitest";
import { executeMotionGraph } from "./execute.js";

function createGraphContext(state: StateStore, channels = new ChannelStore()) {
  const store = new StatefulStore();
  const registry = createDefaultStatefulRegistry();
  return {
    state,
    channels,
    timeline: new TimelineStore(),
    timelineCurrentMs: 0,
    activeTimelineEvents: [],
    deltaTime: 1 / 60,
    time: 0,
    frame: {
      deltaTime: 1 / 60,
      frameNumber: 0,
      elapsedTime: 0,
    },
    statefulStore: store,
    statefulRegistry: registry,
    store,
    registry,
  };
}

describe("executeMotionGraph", () => {
  it("evaluates Interest → Multiply → Smile", () => {
    const state = new StateStore();
    state.set("interest", 0.8);

    const output = executeMotionGraph(
      {
        nodes: [
          { id: "in", type: "stateInput", data: { key: "interest" } },
          { id: "mul", type: "multiply", data: { gain: 0.5 } },
          { id: "out", type: "output", data: { key: "mouthX" } },
        ],
        edges: [
          { id: "e1", source: "in", target: "mul" },
          { id: "e2", source: "mul", target: "out" },
        ],
      },
      createGraphContext(state),
    );

    expect(output.mouthX).toBeCloseTo(0.4, 3);
  });

  it("maps channel volume to mouthY via volumeToMouth", () => {
    const channels = new ChannelStore();
    channels.set("volume", 0.8);

    const output = executeMotionGraph(
      {
        nodes: [
          { id: "vol", type: "volumeToMouth", data: { gain: 1 } },
          { id: "out", type: "output", data: { key: "mouthY" } },
        ],
        edges: [{ id: "e1", source: "vol", target: "out" }],
      },
      createGraphContext(new StateStore(), channels),
    );

    expect(output.mouthY).toBeCloseTo(0.8, 3);
  });

  it("maps timeline phoneme to mouth shape", () => {
    const timeline = new TimelineStore();
    timeline.push({
      startMs: 0,
      endMs: 200,
      type: "phoneme",
      value: { phoneme: "A", strength: 1 },
    });

    const ctx = createGraphContext(new StateStore());
    ctx.timeline = timeline;
    ctx.timelineCurrentMs = 50;
    ctx.activeTimelineEvents = timeline.getActiveEvents(50);

    const output = executeMotionGraph(
      {
        nodes: [
          {
            id: "shape",
            type: "phonemeToShape",
            data: { axis: "mouthY", source: "timeline" },
          },
          { id: "out", type: "output", data: { key: "mouthY" } },
        ],
        edges: [{ id: "e1", source: "shape", target: "out" }],
      },
      ctx,
    );

    expect(output.mouthY).toBeGreaterThan(0.5);
  });

  it("detects cycles", () => {
    expect(() =>
      executeMotionGraph(
        {
          nodes: [
            { id: "a", type: "constant", data: { value: 1 } },
            { id: "b", type: "multiply", data: { gain: 1 } },
          ],
          edges: [
            { id: "e1", source: "a", target: "b" },
            { id: "e2", source: "b", target: "a" },
          ],
        },
        createGraphContext(new StateStore()),
      ),
    ).toThrow(/cycle/i);
  });

  it("evaluates oscillator and smooth stateful nodes", () => {
    const state = new StateStore();
    state.set("interest", 1);

    const ctx = createGraphContext(state);
    let bodyLean = 0;

    for (let frame = 0; frame < 120; frame++) {
      ctx.frame = {
        deltaTime: 1 / 60,
        frameNumber: frame,
        elapsedTime: frame / 60,
      };
      ctx.time = frame / 60;

      const output = executeMotionGraph(
        {
          nodes: [
            { id: "osc", type: "oscillator", data: { frequency: 0.4 } },
            { id: "scale", type: "multiply", data: { gain: 0.1 } },
            { id: "bias", type: "add", data: {} },
            { id: "const", type: "constant", data: { value: 0.5 } },
            { id: "out", type: "output", data: { key: "bodyLean" } },
          ],
          edges: [
            { id: "e1", source: "osc", target: "scale" },
            { id: "e2", source: "scale", target: "bias" },
            { id: "e3", source: "const", target: "bias" },
            { id: "e4", source: "bias", target: "out" },
          ],
        },
        ctx,
      );

      bodyLean = output.bodyLean ?? 0;
    }

    expect(bodyLean).toBeGreaterThan(0.35);
    expect(bodyLean).toBeLessThan(0.65);

    const smoothOutput = executeMotionGraph(
      {
        nodes: [
          { id: "in", type: "stateInput", data: { key: "interest" } },
          { id: "smooth", type: "smooth", data: { speed: 2 } },
          { id: "out", type: "output", data: { key: "mouthX" } },
        ],
        edges: [
          { id: "e1", source: "in", target: "smooth" },
          { id: "e2", source: "smooth", target: "out" },
        ],
      },
      ctx,
    );

    expect(smoothOutput.mouthX).toBeGreaterThan(0);
    expect(smoothOutput.mouthX).toBeLessThanOrEqual(1);

    const springOutput = executeMotionGraph(
      {
        nodes: [
          { id: "in", type: "stateInput", data: { key: "interest" } },
          { id: "spring", type: "spring", data: { stiffness: 180, damping: 18 } },
          { id: "out", type: "output", data: { key: "lookX" } },
        ],
        edges: [
          { id: "e1", source: "in", target: "spring" },
          { id: "e2", source: "spring", target: "out" },
        ],
      },
      ctx,
    );

    expect(springOutput.lookX).toBeGreaterThan(0);
    expect(springOutput.lookX).toBeLessThanOrEqual(1);

    const holdOutput = executeMotionGraph(
      {
        nodes: [
          { id: "hold", type: "randomHold", data: { interval: 2, min: -0.2, max: 0.2 } },
          { id: "scale", type: "multiply", data: { gain: 0.5 } },
          { id: "bias", type: "add", data: {} },
          { id: "const", type: "constant", data: { value: 0.5 } },
          { id: "out", type: "output", data: { key: "lookY" } },
        ],
        edges: [
          { id: "e1", source: "hold", target: "scale" },
          { id: "e2", source: "scale", target: "bias" },
          { id: "e3", source: "const", target: "bias" },
          { id: "e4", source: "bias", target: "out" },
        ],
      },
      ctx,
    );

    expect(holdOutput.lookY).toBeGreaterThanOrEqual(0);
    expect(holdOutput.lookY).toBeLessThanOrEqual(1);
  });

  it("evaluates motionFunction nodes via extension registry callback", () => {
    const output = executeMotionGraph(
      {
        nodes: [
          {
            id: "hb",
            type: "motionFunction",
            data: { functionName: "heartbeat", amplitude: 0.2 },
          },
          { id: "out", type: "output", data: { key: "bodyLean" } },
        ],
        edges: [{ id: "e1", source: "hb", target: "out" }],
      },
      {
        ...createGraphContext(new StateStore()),
        time: 0.25,
        evaluateExtensionFunction: (functionName, args) => {
          expect(functionName).toBe("heartbeat");
          expect(args.amplitude).toBeCloseTo(0.2, 3);
          return 0.7;
        },
      },
    );

    expect(output.bodyLean).toBeCloseTo(0.7, 3);
  });
});
