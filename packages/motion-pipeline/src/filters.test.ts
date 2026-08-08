import { describe, expect, it } from "vitest";

import {
  createClampFilter,
  createDeadzoneFilter,
  createLowPassFilter,
  createMotionFilterPipeline,
} from "./filters.js";

describe("motion frame filters", () => {
  it("zeroes values inside a deadzone and preserves values outside it", () => {
    const filter = createDeadzoneFilter({ deadzone: 0.1 });
    const result = filter.apply(
      {
        timestamp: 1,
        blendShapes: { near: 0.05, positive: 0.4 },
        parameters: { negative: -0.05, far: -0.4 },
      },
      1 / 60,
    );

    expect(result.blendShapes).toEqual({ near: 0, positive: 0.4 });
    expect(result.parameters).toEqual({ negative: 0, far: -0.4 });
  });

  it("clamps only selected numeric channels", () => {
    const filter = createClampFilter({
      min: 0,
      max: 1,
      blendShapes: ["Smile"],
      parameters: ["x"],
    });
    const result = filter.apply(
      {
        timestamp: 1,
        blendShapes: { Smile: 2, Blink: 2 },
        parameters: { x: -1, y: 2 },
      },
      1 / 60,
    );

    expect(result.blendShapes).toEqual({ Smile: 1, Blink: 2 });
    expect(result.parameters).toEqual({ x: 0, y: 2 });
  });

  it("low-passes numeric channels and selected bone transforms", () => {
    const filter = createLowPassFilter({ alpha: 0.5, bones: ["Head"] });
    const first = filter.apply(
      {
        timestamp: 1,
        parameters: { value: 1 },
        bones: {
          Head: {
            position: { x: 1, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
          },
          Hand: { position: { x: 1, y: 0, z: 0 } },
        },
      },
      1 / 60,
    );
    const second = filter.apply(
      {
        timestamp: 2,
        parameters: { value: 0 },
        bones: {
          Head: {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: -1 },
          },
          Hand: { position: { x: 0, y: 0, z: 0 } },
        },
      },
      1 / 60,
    );

    expect(first.parameters?.value).toBe(1);
    expect(second.parameters?.value).toBe(0.5);
    expect(second.bones?.Head?.position?.x).toBe(0.5);
    expect(second.bones?.Head?.rotation?.w).toBeCloseTo(1);
    expect(second.bones?.Hand?.position?.x).toBe(0);
  });

  it("runs filters in order and clears state on reset", () => {
    const lowPass = createLowPassFilter({ alpha: 0.5 });
    const pipeline = createMotionFilterPipeline([
      createDeadzoneFilter({ deadzone: 0.1 }),
      createClampFilter({ min: 0, max: 1 }),
      lowPass,
    ]);

    expect(
      pipeline.apply({ timestamp: 1, parameters: { value: -0.05 } }, 1 / 60).parameters
        ?.value,
    ).toBe(0);
    expect(
      pipeline.apply({ timestamp: 2, parameters: { value: 2 } }, 1 / 60).parameters
        ?.value,
    ).toBe(0.5);

    pipeline.reset();
    expect(
      pipeline.apply({ timestamp: 3, parameters: { value: 1 } }, 1 / 60).parameters
        ?.value,
    ).toBe(1);
  });
});
