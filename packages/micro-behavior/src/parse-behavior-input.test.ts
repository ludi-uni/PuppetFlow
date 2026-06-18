import { describe, expect, it } from "vitest";

import { MicroBehaviorEngine } from "./engine.js";
import {
  parseBehaviorDefinitionInput,
  parseBehaviorInputPayload,
  parseBehaviorRequest,
} from "./parse-behavior-input.js";

describe("parseBehaviorRequest", () => {
  it("parses built-in behavior names", () => {
    expect(parseBehaviorRequest({ behavior: "look_up" })).toEqual({
      behavior: "look_up",
    });
  });

  it("parses custom behavior with inline definition", () => {
    const request = parseBehaviorRequest({
      behavior: "custom_wave",
      definition: {
        duration: 1,
        cooldown: 2,
        keyframes: [
          { t: 0, params: { lookX: 0.5 } },
          { t: 0.5, params: { lookX: 0.8 } },
          { t: 1, params: { lookX: 0.5 } },
        ],
      },
    });

    expect(request?.behavior).toBe("custom_wave");
    expect(request?.definition?.duration).toBe(1);
  });

  it("rejects invalid behavior ids", () => {
    expect(parseBehaviorRequest({ behavior: "bad id" })).toBeNull();
  });
});

describe("parseBehaviorDefinitionInput", () => {
  it("validates keyframes", () => {
    const definition = parseBehaviorDefinitionInput("shake", {
      duration: 0.5,
      keyframes: [
        { t: 0, params: { headTilt: 0 } },
        { t: 0.25, params: { headTilt: 0.1 } },
        { t: 0.5, params: { headTilt: 0 } },
      ],
    });

    expect(definition.id).toBe("shake");
    expect(definition.keyframes).toHaveLength(3);
  });
});

describe("MicroBehaviorEngine custom behaviors", () => {
  it("executes inline custom behavior definitions", () => {
    const engine = new MicroBehaviorEngine({ random: () => 0.5 });
    const accepted = engine.request({
      behavior: "quick_glance",
      definition: {
        id: "quick_glance",
        duration: 1,
        cooldown: 0,
        keyframes: [
          { t: 0, params: { lookX: 0.5 } },
          { t: 0.5, params: { lookX: 0.8 } },
          { t: 1, params: { lookX: 0.5 } },
        ],
      },
    });

    expect(accepted).toBe(true);
    expect(engine.hasBehavior("quick_glance")).toBe(true);

    const sample = engine.tick(0.5)?.motion.lookX;
    expect(sample).toBeGreaterThan(0.5);
  });

  it("reuses registered custom behavior on later requests", () => {
    const engine = new MicroBehaviorEngine({ random: () => 0.5 });
    engine.request({
      behavior: "reuse_me",
      definition: {
        id: "reuse_me",
        duration: 0.2,
        cooldown: 0,
        keyframes: [
          { t: 0, params: { lookY: 0.5 } },
          { t: 0.2, params: { lookY: 0.8 } },
        ],
      },
    });
    engine.tick(0.3);

    expect(engine.request({ behavior: "reuse_me" })).toBe(true);
  });

  it("applies behavior payloads from source-style records", () => {
    const engine = new MicroBehaviorEngine({ random: () => 0.5 });
    const accepted = engine.applyFromInputPayload({ behavior: "look_up" });
    expect(accepted).toBe(true);
    expect(engine.getStatus().activeBehavior).toBe("look_up");
  });

  it("supports websocket behavior envelopes", () => {
    const engine = new MicroBehaviorEngine({ random: () => 0.5 });
    const accepted = engine.applyFromInputPayload({
      type: "behavior",
      behavior: "small_nod",
    });

    expect(accepted).toBe(true);
    expect(
      parseBehaviorInputPayload({ type: "behavior", behavior: "small_nod" })?.behavior,
    ).toBe("small_nod");
  });
});
