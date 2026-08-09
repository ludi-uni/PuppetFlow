import { describe, expect, it } from "vitest";

import { createMotionMixer } from "./mixer.js";

describe("MotionMixer", () => {
  it("omits disabled policy sources from output metadata and inspection", () => {
    const mixer = createMotionMixer([
      { source: "idle", priority: 10, weight: 1 },
      { source: "tracking", priority: 100, weight: 1 },
    ]);
    const inputs = [
      { sourceId: "idle", frame: { timestamp: 1, parameters: { x: 0 } } },
      { sourceId: "tracking", frame: { timestamp: 2, parameters: { x: 1 } } },
    ] as const;
    const policy = { tracking: { enabled: false } } as const;

    expect(mixer.mix(inputs, policy)).toMatchObject({
      parameters: { x: 0 },
      metadata: { sourceIds: ["idle"] },
    });
    expect(mixer.inspect?.(inputs, policy)).toEqual({
      bones: {},
      blendShapes: {},
      parameters: { x: [{ sourceId: "idle", priority: 10, weight: 1 }] },
    });
  });

  it.each([
    ["disabled source", { disabled: { enabled: false, priority: Number.NaN } }],
    ["channel-less frame", { idle: { weight: Number.POSITIVE_INFINITY } }],
  ] as const)("rejects invalid policy values during mix for %s", (_name, policy) => {
    const mixer = createMotionMixer([{ source: "idle", priority: 10 }]);

    expect(() =>
      mixer.mix([{ sourceId: "idle", frame: { timestamp: 1 } }], policy),
    ).toThrow();
  });

  it.each([
    [
      "disabled source",
      { disabled: { enabled: false, priority: Number.NEGATIVE_INFINITY } },
    ],
    ["empty inputs", { idle: { weight: 1.1 } }],
  ] as const)(
    "rejects invalid policy values during inspect for %s",
    (_name, policy) => {
      const mixer = createMotionMixer([{ source: "idle", priority: 10 }]);

      expect(() => mixer.inspect?.([], policy)).toThrow();
    },
  );

  it("applies priority and weight overrides without mutating configured layers or policy", () => {
    const layers = [
      { source: "idle", priority: 10, weight: 1 },
      { source: "tracking", priority: 100, weight: 1 },
    ] as const;
    const mixer = createMotionMixer(layers);
    const inputs = [
      { sourceId: "idle", frame: { timestamp: 1, parameters: { x: 0 } } },
      { sourceId: "tracking", frame: { timestamp: 2, parameters: { x: 1 } } },
    ] as const;
    const policy = {
      tracking: { priority: 10, weight: 0.75 },
      idle: { priority: 10, weight: 0.25 },
    } as const;

    expect(mixer.mix(inputs, policy)?.parameters?.x).toBeCloseTo(0.75);
    expect(mixer.inspect?.(inputs, policy)?.parameters.x).toEqual([
      { sourceId: "idle", priority: 10, weight: 0.25 },
      { sourceId: "tracking", priority: 10, weight: 0.75 },
    ]);
    expect(layers[0]).toEqual({ source: "idle", priority: 10, weight: 1 });
    expect(policy).toEqual({
      tracking: { priority: 10, weight: 0.75 },
      idle: { priority: 10, weight: 0.25 },
    });
  });

  it("preserves no-policy behavior when policy is omitted or undefined", () => {
    const mixer = createMotionMixer([
      { source: "idle", priority: 10 },
      { source: "tracking", priority: 100 },
    ]);
    const inputs = [
      { sourceId: "idle", frame: { timestamp: 1, parameters: { x: 0 } } },
      { sourceId: "tracking", frame: { timestamp: 2, parameters: { x: 1 } } },
    ] as const;

    expect(mixer.mix(inputs, undefined)).toEqual(mixer.mix(inputs));
    expect(mixer.inspect?.(inputs, undefined)).toEqual(mixer.inspect?.(inputs));
  });

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
