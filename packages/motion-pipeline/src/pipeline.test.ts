import { describe, expect, it, vi } from "vitest";

import { createMotionFramePipeline } from "./pipeline.js";
import type { MotionFrameFilter } from "./types.js";

function markerFilter(
  id: string,
  marker: string,
  reset = vi.fn(),
): MotionFrameFilter {
  return {
    id,
    apply(frame) {
      return {
        ...frame,
        parameters: {
          ...frame.parameters,
          order: marker === "S"
            ? (frame.parameters?.order ?? 0) + 1
            : (frame.parameters?.order ?? 0) * 10,
        },
      };
    },
    reset,
  };
}

describe("createMotionFramePipeline", () => {
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
