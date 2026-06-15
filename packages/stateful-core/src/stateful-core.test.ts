import { describe, expect, it } from "vitest";
import {
  createDefaultStatefulRegistry,
  createRuntimeStatefulRegistry,
  runStatefulNumber,
} from "./index.js";
import { StatefulStore } from "./store.js";
import type { FrameContext } from "./types.js";

function frame(deltaTime: number, frameNumber: number): FrameContext {
  return {
    deltaTime,
    frameNumber,
    elapsedTime: frameNumber * deltaTime,
  };
}

describe("StatefulStore", () => {
  it("isolates state by function name and instance id", () => {
    const store = new StatefulStore();
    const registry = createDefaultStatefulRegistry();

    const a = store.evaluate(
      "oscillator",
      "a",
      { frequency: 1 },
      0,
      frame(0.016, 0),
      registry,
    );
    const b = store.evaluate(
      "oscillator",
      "b",
      { frequency: 2 },
      0,
      frame(0.016, 0),
      registry,
    );

    expect(a).not.toBe(b);
  });

  it("resets all state", () => {
    const store = new StatefulStore();
    const registry = createDefaultStatefulRegistry();

    store.evaluate(
      "oscillator",
      "body",
      { frequency: 1 },
      0,
      frame(0.016, 0),
      registry,
    );
    expect(store.peek("oscillator", "body")).toBeDefined();

    store.reset();
    expect(store.peek("oscillator", "body")).toBeUndefined();
    expect(store.snapshot()).toEqual([]);
  });

  it("snapshots function name, id, last value, and internal state", () => {
    const store = new StatefulStore();
    const registry = createDefaultStatefulRegistry();

    store.evaluate(
      "oscillator",
      "body",
      { frequency: 0.5 },
      0,
      frame(1 / 60, 0),
      registry,
    );
    store.evaluate("smooth", "interest", { speed: 2 }, 1, frame(1 / 60, 1), registry);

    const snapshot = store.snapshot();
    expect(snapshot).toHaveLength(2);
    expect(snapshot[0]).toMatchObject({
      functionName: "oscillator",
      instanceId: "body",
    });
    expect(typeof snapshot[0].lastValue).toBe("number");
    expect(snapshot[0].state).toMatchObject({ phase: expect.any(Number) });
    expect(snapshot[1].functionName).toBe("smooth");
  });
});

describe("oscillator", () => {
  it("outputs sin wave in -1..1 and keeps phase across frequency changes", () => {
    const store = new StatefulStore();
    const registry = createDefaultStatefulRegistry();

    const values: number[] = [];
    for (let i = 0; i < 120; i++) {
      values.push(
        store.evaluate(
          "oscillator",
          "body",
          { frequency: 0.5 },
          0,
          frame(1 / 60, i),
          registry,
        ) as number,
      );
    }

    expect(Math.min(...values)).toBeGreaterThanOrEqual(-1);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    expect(values.some((value) => value > 0)).toBe(true);
    expect(values.some((value) => value < 0)).toBe(true);

    const before = store.evaluate(
      "oscillator",
      "body",
      { frequency: 0.5 },
      0,
      frame(1 / 60, 30),
      registry,
    ) as number;
    const after = store.evaluate(
      "oscillator",
      "body",
      { frequency: 2 },
      0,
      frame(1 / 60, 31),
      registry,
    ) as number;

    expect(before).not.toBe(0);
    expect(after).not.toBe(0);
  });

  it("keeps phase continuity when phaseOffset changes output only", () => {
    const store = new StatefulStore();
    const registry = createDefaultStatefulRegistry();

    const plain = store.evaluate(
      "oscillator",
      "plain",
      { frequency: 1 },
      0,
      frame(1 / 60, 10),
      registry,
    ) as number;
    const offset = store.evaluate(
      "oscillator",
      "offset",
      { frequency: 1, phaseOffset: Math.PI / 2 },
      0,
      frame(1 / 60, 10),
      registry,
    ) as number;

    expect(plain).not.toBe(offset);
  });
});

describe("smooth", () => {
  it("eases toward the target value over frames", () => {
    const store = new StatefulStore();
    const registry = createDefaultStatefulRegistry();

    let current = 0;
    for (let i = 0; i < 60; i++) {
      current = store.evaluate(
        "smooth",
        "interest",
        { speed: 4 },
        1,
        frame(1 / 60, i),
        registry,
      ) as number;
    }

    expect(current).toBeGreaterThan(0.8);
    expect(current).toBeLessThanOrEqual(1);
  });
});

describe("spring", () => {
  it("follows target with inertia and damping", () => {
    const store = new StatefulStore();
    const registry = createDefaultStatefulRegistry();

    let position = 0;
    for (let i = 0; i < 180; i++) {
      position = store.evaluate(
        "spring",
        "ear",
        { stiffness: 180, damping: 18 },
        1,
        frame(1 / 60, i),
        registry,
      ) as number;
    }

    expect(position).toBeGreaterThan(0.85);
    expect(position).toBeLessThanOrEqual(1.05);
  });

  it("does not snap instantly when the target steps", () => {
    const store = new StatefulStore();
    const registry = createDefaultStatefulRegistry();

    for (let i = 0; i < 10; i++) {
      store.evaluate(
        "spring",
        "step",
        { stiffness: 120, damping: 16 },
        0,
        frame(1 / 60, i),
        registry,
      );
    }

    const afterStep = store.evaluate(
      "spring",
      "step",
      { stiffness: 120, damping: 16 },
      1,
      frame(1 / 60, 10),
      registry,
    ) as number;

    expect(afterStep).toBeGreaterThan(0);
    expect(afterStep).toBeLessThan(0.5);
  });
});

describe("randomHold", () => {
  it("holds a value until the interval elapses", () => {
    const store = new StatefulStore();
    const registry = createDefaultStatefulRegistry();

    const first = store.evaluate(
      "randomHold",
      "look",
      { interval: 1, min: -0.3, max: 0.3 },
      0,
      frame(1 / 60, 0),
      registry,
    ) as number;

    const held = store.evaluate(
      "randomHold",
      "look",
      { interval: 1, min: -0.3, max: 0.3 },
      0,
      frame(1 / 60, 30),
      registry,
    ) as number;

    const changed = store.evaluate(
      "randomHold",
      "look",
      { interval: 1, min: -0.3, max: 0.3 },
      0,
      frame(1 / 60, 70),
      registry,
    ) as number;

    expect(first).toBeGreaterThanOrEqual(-0.3);
    expect(first).toBeLessThanOrEqual(0.3);
    expect(held).toBe(first);
    expect(changed).toBeGreaterThanOrEqual(-0.3);
    expect(changed).toBeLessThanOrEqual(0.3);
  });

  it("is deterministic for the same instance id", () => {
    const run = () => {
      const store = new StatefulStore();
      const registry = createDefaultStatefulRegistry();
      const values: number[] = [];
      for (let i = 0; i < 180; i++) {
        values.push(
          store.evaluate(
            "randomHold",
            "look",
            { interval: 0.5, min: 0, max: 1 },
            0,
            frame(1 / 60, i),
            registry,
          ) as number,
        );
      }
      return values;
    };

    expect(run()).toEqual(run());
  });
});

describe("blink", () => {
  it("produces blink pulses between 0 and 1", () => {
    const store = new StatefulStore();
    const registry = createDefaultStatefulRegistry();
    const values: number[] = [];

    for (let i = 0; i < 600; i++) {
      values.push(
        store.evaluate(
          "blink",
          "eyes",
          { averageInterval: 0.5 },
          0,
          frame(1 / 60, i),
          registry,
        ) as number,
      );
    }

    expect(values.some((value) => value > 0.5)).toBe(true);
    expect(values.some((value) => value === 0)).toBe(true);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
  });
});

describe("breath", () => {
  it("outputs a natural 0..1 breathing cycle", () => {
    const store = new StatefulStore();
    const registry = createDefaultStatefulRegistry();
    const values: number[] = [];

    for (let i = 0; i < 240; i++) {
      values.push(
        store.evaluate(
          "breath",
          "chest",
          { rate: 0.25 },
          0,
          frame(1 / 60, i),
          registry,
        ) as number,
      );
    }

    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.2);
  });
});

describe("wander", () => {
  it("moves smoothly within roughly -1..1", () => {
    const store = new StatefulStore();
    const registry = createDefaultStatefulRegistry();
    let previous = 0;

    for (let i = 0; i < 180; i++) {
      const value = store.evaluate(
        "wander",
        "lookX",
        { speed: 0.3 },
        0,
        frame(1 / 60, i),
        registry,
      ) as number;
      expect(Math.abs(value - previous)).toBeLessThan(0.2);
      previous = value;
    }

    expect(Math.min(previous, 0)).toBeGreaterThan(-1.5);
    expect(Math.max(previous, 0)).toBeLessThan(1.5);
  });
});

describe("cooldown", () => {
  it("allows once per duration window", () => {
    const store = new StatefulStore();
    const registry = createDefaultStatefulRegistry();

    const first = store.evaluate(
      "cooldown",
      "action",
      { duration: 1 },
      0,
      frame(1 / 60, 0),
      registry,
    );
    const blocked = store.evaluate(
      "cooldown",
      "action",
      { duration: 1 },
      0,
      frame(1 / 60, 1),
      registry,
    );
    const allowed = store.evaluate(
      "cooldown",
      "action",
      { duration: 1 },
      0,
      { deltaTime: 1 / 60, frameNumber: 70, elapsedTime: 70 / 60 },
      registry,
    );

    expect(first).toBe(true);
    expect(blocked).toBe(false);
    expect(allowed).toBe(true);
  });
});

describe("createRuntimeStatefulRegistry", () => {
  it("includes physics functions from bundled plugins", () => {
    const registry = createRuntimeStatefulRegistry();
    const store = new StatefulStore();

    const tail = store.evaluate(
      "tailPhysics",
      "tail",
      { frequency: 1.2, amplitude: 0.4 },
      0,
      frame(1 / 60, 0),
      registry,
    ) as number;

    const ear = store.evaluate(
      "earPhysics",
      "ear",
      { intensity: 0.4 },
      0,
      frame(1 / 60, 0),
      registry,
    ) as number;

    expect(tail).toBeGreaterThanOrEqual(0);
    expect(tail).toBeLessThanOrEqual(1);
    expect(ear).toBeGreaterThanOrEqual(0);
    expect(ear).toBeLessThanOrEqual(1);
  });
});

describe("tailPhysics", () => {
  it("oscillates with spring damping in 0..1 range", () => {
    const store = new StatefulStore();
    const registry = createRuntimeStatefulRegistry();
    const values: number[] = [];

    for (let i = 0; i < 240; i++) {
      values.push(
        store.evaluate(
          "tailPhysics",
          "tail",
          { frequency: 1.2, amplitude: 0.45 },
          0,
          frame(1 / 60, i),
          registry,
        ) as number,
      );
    }

    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.1);
  });
});

describe("earPhysics", () => {
  it("holds random targets with spring motion", () => {
    const store = new StatefulStore();
    const registry = createRuntimeStatefulRegistry();
    const values: number[] = [];

    for (let i = 0; i < 300; i++) {
      values.push(
        store.evaluate(
          "earPhysics",
          "ear",
          { intensity: 0.4, holdInterval: 0.5 },
          0,
          frame(1 / 60, i),
          registry,
        ) as number,
      );
    }

    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    expect(new Set(values.map((v) => Math.round(v * 20) / 20)).size).toBeGreaterThan(3);
  });

  it("is deterministic for the same instance id", () => {
    const run = () => {
      const store = new StatefulStore();
      const registry = createRuntimeStatefulRegistry();
      const values: number[] = [];
      for (let i = 0; i < 180; i++) {
        values.push(
          store.evaluate(
            "earPhysics",
            "ear",
            { intensity: 0.4 },
            0,
            frame(1 / 60, i),
            registry,
          ) as number,
        );
      }
      return values;
    };

    expect(run()).toEqual(run());
  });
});

describe("runStatefulNumber", () => {
  it("returns undefined when store or registry is missing", () => {
    expect(
      runStatefulNumber({ deltaTime: 0.016, time: 1 }, "oscillator", "x"),
    ).toBeUndefined();
  });

  it("evaluates through extension context", () => {
    const store = new StatefulStore();
    const registry = createDefaultStatefulRegistry();
    const value = runStatefulNumber(
      {
        deltaTime: 1 / 60,
        time: 1,
        statefulStore: store,
        statefulRegistry: registry,
        frame: frame(1 / 60, 60),
      },
      "oscillator",
      "ext",
      { frequency: 0.5 },
    );

    expect(value).toBeGreaterThanOrEqual(-1);
    expect(value).toBeLessThanOrEqual(1);
  });
});
