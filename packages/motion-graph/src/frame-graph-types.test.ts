import { describe, expect, it } from "vitest";
import { parseMotionFrameGraph } from "./frame-graph-types.js";

const valid = {
  version: 1,
  initialState: "idle",
  states: [
    { id: "idle", sources: { idle: { enabled: true, priority: 10 } } },
    {
      id: "tracking",
      sources: {
        idle: { enabled: false },
        tracker: { enabled: true, priority: 100, weight: 0.8 },
      },
    },
  ],
  transitions: [
    {
      from: "idle",
      to: "tracking",
      when: { type: "signal", key: "tracking", operator: "equals", value: true },
    },
  ],
} as const;

describe("parseMotionFrameGraph", () => {
  it("validates and clones a version 1 document", () => {
    const parsed = parseMotionFrameGraph(valid);

    expect(parsed).toEqual(valid);
    expect(parsed).not.toBe(valid);
    expect(parsed.states[0]).not.toBe(valid.states[0]);
    expect(parsed.states[0].sources).not.toBe(valid.states[0].sources);
    expect(parsed.transitions).not.toBe(valid.transitions);
  });

  it("preserves an unknown __proto__ source ID as an own policy entry", () => {
    const document = JSON.parse(
      '{"version":1,"initialState":"idle","states":[{"id":"idle","sources":{"__proto__":{"enabled":true,"weight":0.5}}}]}',
    );

    const parsed = parseMotionFrameGraph(document);
    const sources = parsed.states[0].sources as Record<
      string,
      { enabled?: boolean; weight?: number }
    >;

    expect(Object.prototype.hasOwnProperty.call(sources, "__proto__")).toBe(true);
    expect(sources["__proto__"]).toEqual({ enabled: true, weight: 0.5 });
  });

  it.each([
    [{ ...valid, initialState: "missing" }, "initialState"],
    [{ ...valid, states: [{ id: "idle" }, { id: "idle" }] }, "duplicate"],
    [
      {
        ...valid,
        transitions: [{ from: "idle", to: "missing", when: valid.transitions[0].when }],
      },
      "transition",
    ],
    [
      { ...valid, states: [{ id: "idle", sources: { idle: { weight: 2 } } }] },
      "weight",
    ],
    [
      {
        ...valid,
        transitions: [
          { from: "idle", to: "tracking", when: { type: "elapsed", minimumMs: -1 } },
        ],
      },
      "minimumMs",
    ],
  ])("rejects invalid graph %#", (document, message) => {
    expect(() => parseMotionFrameGraph(document)).toThrow(message);
  });

  it.each([
    [{ ...valid, version: 2 }, "version"],
    [{ ...valid, states: [] }, "states"],
    [{ ...valid, states: [{ id: " " }] }, "id"],
    [
      { ...valid, states: [{ id: "idle", sources: { idle: { priority: Infinity } } }] },
      "priority",
    ],
    [
      {
        ...valid,
        transitions: [
          {
            from: "idle",
            to: "tracking",
            when: { type: "signal", key: " ", operator: "equals", value: true },
          },
        ],
      },
      "key",
    ],
    [
      {
        ...valid,
        transitions: [
          {
            from: "idle",
            to: "tracking",
            when: { type: "signal", key: "tracking", operator: "unknown", value: true },
          },
        ],
      },
      "operator",
    ],
    [
      {
        ...valid,
        transitions: [
          {
            from: "idle",
            to: "tracking",
            when: { type: "source", sourceId: " ", field: "connected", equals: true },
          },
        ],
      },
      "sourceId",
    ],
    [
      {
        ...valid,
        transitions: [
          {
            from: "idle",
            to: "tracking",
            when: {
              type: "source",
              sourceId: "tracker",
              field: "unknown",
              equals: true,
            },
          },
        ],
      },
      "field",
    ],
    [
      {
        ...valid,
        transitions: [
          {
            from: "idle",
            to: "tracking",
            when: {
              type: "source",
              sourceId: "tracker",
              field: "connected",
              equals: "yes",
            },
          },
        ],
      },
      "equals",
    ],
    [
      {
        ...valid,
        transitions: [
          {
            from: "idle",
            to: "tracking",
            when: { type: "elapsed", minimumMs: Infinity },
          },
        ],
      },
      "minimumMs",
    ],
  ])("rejects malformed graph fields %#", (document, message) => {
    expect(() => parseMotionFrameGraph(document)).toThrow(message);
  });
});
