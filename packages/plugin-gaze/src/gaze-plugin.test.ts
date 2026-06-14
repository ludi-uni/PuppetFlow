import { ChannelStore, DEFAULT_MOTION_STATE, StateStore } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import { GazePlugin } from "./gaze-plugin.js";

function pluginInput(state: StateStore) {
  return { state, channels: new ChannelStore() };
}

describe("GazePlugin", () => {
  it("outputs lookX and lookY around neutral", () => {
    const plugin = new GazePlugin({ wanderAmplitude: 0.04, speed: 0.12 });
    plugin.process(pluginInput(new StateStore()), DEFAULT_MOTION_STATE);
    const output = plugin.process(pluginInput(new StateStore()), DEFAULT_MOTION_STATE);

    expect(output.lookX).toBeDefined();
    expect(output.lookY).toBeDefined();
    expect(output.lookX).not.toBe(0.5);
    expect(output.lookY).not.toBe(0.5);
  });

  it("uses stateful oscillators when runStatefulNumber is provided", () => {
    const plugin = new GazePlugin({ wanderAmplitude: 0.1, speed: 0.12 });
    const output = plugin.process(pluginInput(new StateStore()), DEFAULT_MOTION_STATE, {
      deltaTime: 1 / 60,
      time: 1,
      runStatefulNumber: (name, id, config) => {
        expect(name).toBe("oscillator");
        expect(id).toMatch(/^gaze:look/);
        if (id === "gaze:lookY") {
          expect(config?.phaseOffset).toBeCloseTo(Math.PI * 0.35, 5);
        }
        return id === "gaze:lookX" ? 0.4 : -0.2;
      },
    });

    expect(output.lookX).toBeCloseTo(0.54, 2);
    expect(output.lookY).toBeCloseTo(0.483, 2);
  });

  it("clamps speed to configured maximum", () => {
    const plugin = new GazePlugin({ speed: 99 });
    expect((plugin as unknown as { speed: number }).speed).toBe(0.5);
  });
});
