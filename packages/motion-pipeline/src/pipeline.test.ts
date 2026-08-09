import { describe, expect, it, vi } from "vitest";

import type { MotionLayerPolicy } from "./index.js";
import { createMotionFramePipeline } from "./pipeline.js";
import type { MotionFrameFilter } from "./types.js";

function markerFilter(id: string, marker: string, reset = vi.fn()): MotionFrameFilter {
  return {
    id,
    apply(frame) {
      return {
        ...frame,
        parameters: {
          ...frame.parameters,
          order:
            marker === "S"
              ? (frame.parameters?.order ?? 0) + 1
              : (frame.parameters?.order ?? 0) * 10,
        },
      };
    },
    reset,
  };
}

describe("createMotionFramePipeline", () => {
  it("forwards source policy to mixer process and inspection", () => {
    const mix = vi.fn(() => ({ timestamp: 1 }));
    const inspect = vi.fn(() => ({ bones: {}, blendShapes: {}, parameters: {} }));
    const pipeline = createMotionFramePipeline({ mixer: { mix, inspect } });
    const inputs = [
      { sourceId: "tracker", frame: { timestamp: 1, parameters: { x: 1 } } },
    ];
    const policy: MotionLayerPolicy = {
      tracker: { enabled: false, priority: 200 },
    };

    pipeline.process(inputs, 1 / 60, policy);
    pipeline.inspect?.(inputs, policy);

    expect(mix).toHaveBeenCalledWith(expect.any(Array), policy);
    expect(inspect).toHaveBeenCalledWith(expect.any(Array), policy);
  });

  it("does not apply disabled source filters before process or inspect", () => {
    const disabledFilter: MotionFrameFilter = {
      id: "disabled",
      apply() {
        throw new Error("disabled filter called");
      },
      reset: vi.fn(),
    };
    const mix = vi.fn(() => ({ timestamp: 1 }));
    const inspect = vi.fn(() => ({ bones: {}, blendShapes: {}, parameters: {} }));
    const pipeline = createMotionFramePipeline({
      sourceFilters: { disabled: [disabledFilter] },
      mixer: { mix, inspect },
    });
    const inputs = [{ sourceId: "disabled", frame: { timestamp: 1 } }];
    const policy = { disabled: { enabled: false } } satisfies MotionLayerPolicy;

    expect(() => pipeline.process(inputs, 1 / 60, policy)).not.toThrow();
    expect(() => pipeline.inspect?.(inputs, policy)).not.toThrow();
    expect(mix).toHaveBeenCalledWith([], policy);
    expect(inspect).toHaveBeenCalledWith([], policy);
  });

  it("keeps enabled output when a disabled source filter throws", () => {
    const pipeline = createMotionFramePipeline({
      sourceFilters: {
        disabled: [
          {
            id: "disabled",
            apply() {
              throw new Error("disabled filter called");
            },
            reset: vi.fn(),
          },
        ],
      },
      mixer: {
        mix: (inputs) => inputs[0]?.frame,
      },
    });

    expect(
      pipeline.process(
        [
          { sourceId: "disabled", frame: { timestamp: 1 } },
          { sourceId: "enabled", frame: { timestamp: 2 } },
        ],
        1 / 60,
        { disabled: { enabled: false } },
      ),
    ).toEqual({ timestamp: 2 });
  });

  it("exposes mixer ownership after retarget mapping", () => {
    const pipeline = createMotionFramePipeline({
      layers: [{ source: "webcam", priority: 110, bones: ["Head"] }],
      retarget: { mapping: { Head: "HeadTarget" } },
    });

    const inspection = pipeline.inspect?.([
      {
        sourceId: "webcam",
        frame: {
          timestamp: 1,
          bones: { Head: { rotation: { x: 0, y: 0, z: 0, w: 1 } } },
        },
      },
    ]);

    expect(inspection?.bones.HeadTarget).toEqual([
      { sourceId: "webcam", priority: 110, weight: 1 },
    ]);
    expect(inspection?.bones.Head).toBeUndefined();
  });

  it("leaves custom pipelines without mixer inspection optional", () => {
    const pipeline = createMotionFramePipeline({
      mixer: {
        mix: () => ({ timestamp: 1 }),
      },
    });

    expect(pipeline.inspect?.([])).toBeUndefined();
  });

  it("applies source filters, mixer, retarget, and output filters in order", () => {
    const pipeline = createMotionFramePipeline({
      sourceFilters: {
        body: [markerFilter("source", "S")],
      },
      layers: [{ source: "body", priority: 100 }],
      retarget: { mapping: { InputHead: "Head" } },
      outputFilters: [markerFilter("output", "O")],
    });

    const result = pipeline.process(
      [
        {
          sourceId: "body",
          frame: {
            timestamp: 1,
            bones: { InputHead: { position: { x: 1, y: 0, z: 0 } } },
            parameters: { order: 0 },
          },
        },
      ],
      1 / 60,
    );

    expect(result?.parameters?.order).toBe(10);
    expect(result?.bones?.Head?.position).toEqual({ x: 1, y: 0, z: 0 });
    expect(result?.bones?.InputHead).toBeUndefined();
  });

  it("returns undefined for empty input", () => {
    const pipeline = createMotionFramePipeline({});
    expect(pipeline.process([], 1 / 60)).toBeUndefined();
  });

  it("resets every configured filter", () => {
    const sourceReset = vi.fn();
    const outputReset = vi.fn();
    const pipeline = createMotionFramePipeline({
      sourceFilters: { source: [markerFilter("source", "S", sourceReset)] },
      outputFilters: [markerFilter("output", "O", outputReset)],
    });

    pipeline.reset();

    expect(sourceReset).toHaveBeenCalledTimes(1);
    expect(outputReset).toHaveBeenCalledTimes(1);
  });
});
