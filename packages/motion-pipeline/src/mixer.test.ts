import { describe, expect, it } from "vitest";

import { createMotionMixer } from "./mixer.js";

describe("MotionMixer", () => {
  it("reports highest-priority owners and weighted contributors", () => {
    const mixer = createMotionMixer([
      {
        source: "body",
        priority: 90,
        bones: ["Hips"],
        blendShapes: ["Smile"],
        parameters: ["lean"],
      },
      { source: "webcam", priority: 110, bones: ["Head"] },
      { source: "face-a", priority: 100, weight: 0.25, blendShapes: ["Smile"] },
      { source: "face-b", priority: 100, weight: 0.75, blendShapes: ["Smile"] },
      { source: "missing", priority: 200, bones: ["Missing"] },
    ]);

    const inspection = (
      mixer as unknown as {
        inspect(inputs: readonly unknown[]): {
          bones: Record<string, unknown>;
          blendShapes: Record<string, unknown>;
          parameters: Record<string, unknown>;
        };
      }
    ).inspect([
      {
        sourceId: "body",
        frame: {
          timestamp: 1,
          bones: {
            Hips: { position: { x: 0, y: 0, z: 0 } },
            Head: { rotation: { x: 0, y: 0, z: 0, w: 1 } },
          },
          blendShapes: { Smile: 0.4 },
          parameters: { lean: 0.2 },
        },
      },
      {
        sourceId: "webcam",
        frame: {
          timestamp: 2,
          bones: { Head: { rotation: { x: 0, y: 0, z: 0, w: 1 } } },
        },
      },
      {
        sourceId: "face-a",
        frame: { timestamp: 3, blendShapes: { Smile: 0.2 } },
      },
      {
        sourceId: "face-b",
        frame: { timestamp: 4, blendShapes: { Smile: 0.8 } },
      },
    ]);

    expect(inspection.bones.Hips).toEqual([
      { sourceId: "body", priority: 90, weight: 1 },
    ]);
    expect(inspection.bones.Head).toEqual([
      { sourceId: "webcam", priority: 110, weight: 1 },
    ]);
    expect(inspection.blendShapes.Smile).toEqual([
      { sourceId: "face-a", priority: 100, weight: 0.25 },
      { sourceId: "face-b", priority: 100, weight: 0.75 },
    ]);
    expect(inspection.parameters).toEqual({
      lean: [{ sourceId: "body", priority: 90, weight: 1 }],
    });
    expect(inspection.bones.Missing).toBeUndefined();
  });

  it("lets the highest-priority source override a lower-priority source", () => {
    const mixer = createMotionMixer([
      { source: "idle", priority: 10 },
      { source: "tracking", priority: 100 },
    ]);

    const result = mixer.mix([
      {
        sourceId: "idle",
        frame: { timestamp: 10, bones: { Head: { position: { x: 0, y: 0, z: 0 } } } },
      },
      {
        sourceId: "tracking",
        frame: { timestamp: 20, bones: { Head: { position: { x: 1, y: 2, z: 3 } } } },
      },
    ]);

    expect(result?.bones?.Head?.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(result?.timestamp).toBe(20);
  });

  it("blends same-priority numeric channels by layer weight", () => {
    const mixer = createMotionMixer([
      { source: "a", priority: 10, weight: 0.25 },
      { source: "b", priority: 10, weight: 0.75 },
    ]);

    const result = mixer.mix([
      { sourceId: "a", frame: { timestamp: 1, parameters: { lean: 0 } } },
      { sourceId: "b", frame: { timestamp: 2, parameters: { lean: 1 } } },
    ]);

    expect(result?.parameters?.lean).toBeCloseTo(0.75);
  });

  it("applies independent bone, blendShape, and parameter masks", () => {
    const mixer = createMotionMixer([
      {
        source: "body",
        priority: 100,
        bones: ["Hips"],
        blendShapes: ["Smile"],
        parameters: ["lean"],
      },
      { source: "fallback", priority: 10 },
    ]);

    const result = mixer.mix([
      {
        sourceId: "body",
        frame: {
          timestamp: 1,
          bones: {
            Hips: { position: { x: 1, y: 0, z: 0 } },
            Head: { position: { x: 1, y: 0, z: 0 } },
          },
          blendShapes: { Smile: 1, Blink: 1 },
          parameters: { lean: 1, sway: 1 },
        },
      },
      {
        sourceId: "fallback",
        frame: {
          timestamp: 2,
          bones: {
            Hips: { position: { x: 0, y: 0, z: 0 } },
            Head: { position: { x: 0, y: 0, z: 0 } },
          },
          blendShapes: { Smile: 0, Blink: 0 },
          parameters: { lean: 0, sway: 0 },
        },
      },
    ]);

    expect(result?.bones?.Hips?.position?.x).toBe(1);
    expect(result?.bones?.Head?.position?.x).toBe(0);
    expect(result?.blendShapes).toEqual({ Smile: 1, Blink: 0 });
    expect(result?.parameters).toEqual({ lean: 1, sway: 0 });
  });

  it("preserves partial transform components and opposite quaternion signs", () => {
    const mixer = createMotionMixer([
      { source: "position", priority: 10 },
      { source: "rotation-a", priority: 10, weight: 0.5 },
      { source: "rotation-b", priority: 10, weight: 0.5 },
    ]);

    const result = mixer.mix([
      {
        sourceId: "position",
        frame: { timestamp: 1, bones: { Head: { position: { x: 3, y: 0, z: 0 } } } },
      },
      {
        sourceId: "rotation-a",
        frame: {
          timestamp: 2,
          bones: { Head: { rotation: { x: 0, y: 0, z: 0, w: 1 } } },
        },
      },
      {
        sourceId: "rotation-b",
        frame: {
          timestamp: 3,
          bones: { Head: { rotation: { x: 0, y: 0, z: 0, w: -1 } } },
        },
      },
    ]);

    expect(result?.bones?.Head?.position).toEqual({ x: 3, y: 0, z: 0 });
    expect(result?.bones?.Head?.rotation?.w).toBeCloseTo(1);
  });

  it("returns undefined for empty input and ignores missing configured sources", () => {
    const mixer = createMotionMixer([{ source: "missing", priority: 100 }]);

    expect(mixer.mix([])).toBeUndefined();
    expect(
      mixer.mix([
        { sourceId: "unconfigured", frame: { timestamp: 1, parameters: { x: 0.4 } } },
      ])?.parameters?.x,
    ).toBe(0.4);
  });
});
