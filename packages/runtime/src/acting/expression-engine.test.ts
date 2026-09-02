import { describe, expect, it } from "vitest";

import { ExpressionEngine, type ActingExpressionProfile } from "./index.js";

const PROFILE: ActingExpressionProfile = {
  id: "test-expressions",
  expressions: {
    happy: { blendShape: "Joy" },
    sad: { blendShape: "Sorrow" },
  },
};

describe("ExpressionEngine", () => {
  it("accepts set_expression immediately and does not wait for duration", () => {
    const engine = new ExpressionEngine({ profile: PROFILE });
    const result = engine.set_expression("happy", {
      intensity: 0.6,
      duration: 1.5,
      fadeIn: 0.15,
      fadeOut: 0.2,
    });

    expect(result.accepted).toBe(true);
    expect(result.state.activeExpression).toMatchObject({ expression: "happy" });
    expect(result.state.remaining).toBe(1.5);
  });

  it("fades in, holds, fades out, and emits a zero endpoint", () => {
    const engine = new ExpressionEngine({ profile: PROFILE });
    engine.set_expression("happy", {
      intensity: 0.6,
      duration: 1.5,
      fadeIn: 0.15,
      fadeOut: 0.2,
    });

    expect(engine.tick(0.075).Joy).toBeCloseTo(0.3, 2);
    expect(engine.tick(0.075).Joy).toBeCloseTo(0.6, 2);
    expect(engine.tick(1.0).Joy).toBeCloseTo(0.6, 2);
    expect(engine.tick(0.1).Joy).toBeGreaterThan(0);
    expect(engine.tick(0.25)).toEqual({ Joy: 0, Sorrow: 0 });
    expect(engine.get_expression_state().activeExpression).toBeUndefined();
  });

  it("holds an omitted-duration expression until clear_expression", () => {
    const engine = new ExpressionEngine({ profile: PROFILE });
    engine.set_expression("sad", { intensity: 0.4, fadeIn: 0 });
    engine.tick(10);

    expect(engine.get_expression_state().remaining).toBe(Infinity);
    expect(engine.clear_expression({ fadeOut: 0.2 }).accepted).toBe(true);
    expect(engine.tick(0.2)).toEqual({ Joy: 0, Sorrow: 0 });
  });

  it("replaces from currently interpolated values and preserves owned channels only", () => {
    const engine = new ExpressionEngine({ profile: PROFILE });
    engine.set_expression("happy", { intensity: 0.6, fadeIn: 0 });
    const current = engine.tick(0.1);
    engine.set_expression("sad", { intensity: 0.4, fadeIn: 0.15 });

    expect(engine.tick(0).Joy).toBeCloseTo(current.Joy);
    expect(Object.keys(engine.tick(0))).toEqual(["Joy", "Sorrow"]);
  });

  it("rejects invalid expressions without changing active expression", () => {
    const engine = new ExpressionEngine({ profile: PROFILE });
    engine.set_expression("happy", { intensity: 0.5, fadeIn: 0 });
    const before = engine.get_expression_state();

    const result = engine.set_expression("surprised", { intensity: 0.5 });

    expect(result.accepted).toBe(false);
    expect(engine.get_expression_state()).toEqual(before);
  });

  it("does not consume an expression ID for a rejected request", () => {
    const engine = new ExpressionEngine({ profile: PROFILE });

    expect(engine.set_expression("surprised").accepted).toBe(false);
    expect(engine.set_expression("happy").state.activeExpressionId).toBe(1);
  });

  it("rejects finite durations shorter than their fade window", () => {
    const engine = new ExpressionEngine({ profile: PROFILE });

    expect(
      engine.set_expression("happy", { duration: 0.2, fadeIn: 0.1, fadeOut: 0.2 }),
    ).toMatchObject({ accepted: false });
  });

  it("emits the initial neutral record once, then becomes idle", () => {
    const engine = new ExpressionEngine({ profile: PROFILE });

    expect(engine.tick(0)).toEqual({ Joy: 0, Sorrow: 0 });
    expect(engine.tick(0)).toEqual({});
  });

  it("returns to neutral idle after set_expression neutral", () => {
    const engine = new ExpressionEngine({ profile: PROFILE });
    engine.set_expression("happy", { fadeIn: 0 });
    engine.tick(0);

    expect(engine.set_expression("neutral").accepted).toBe(true);
    expect(engine.tick(0.15)).toEqual({ Joy: 0, Sorrow: 0 });
    expect(engine.get_expression_state().activeExpression).toBeUndefined();
    expect(engine.tick(0)).toEqual({});
  });

  it("reset clears active state and emits neutral once", () => {
    const engine = new ExpressionEngine({ profile: PROFILE });
    engine.set_expression("happy", { fadeIn: 0 });
    engine.tick(0);

    engine.reset();

    expect(engine.get_expression_state()).toEqual({
      elapsed: 0,
      remaining: 0,
      fadeRemaining: 0,
    });
    expect(engine.tick(0)).toEqual({ Joy: 0, Sorrow: 0 });
    expect(engine.tick(0)).toEqual({});
  });

  it("returns cloned channel records", () => {
    const engine = new ExpressionEngine({ profile: PROFILE });
    engine.set_expression("happy", { fadeIn: 0 });
    const result = engine.tick(0);
    result.Joy = 0;

    expect(engine.tick(0).Joy).toBe(1);
  });
});
