import { ChannelStore, StateStore, TimelineStore } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import { executeMotionGraph } from "./execute.js";

function createGraphContext(state: StateStore, channels = new ChannelStore()) {
  return {
    state,
    channels,
    timeline: new TimelineStore(),
    timelineCurrentMs: 0,
    activeTimelineEvents: [],
    deltaTime: 0.016,
    time: 0,
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
});
