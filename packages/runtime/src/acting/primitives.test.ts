import { describe, expect, it } from "vitest";

import type { ActingActionRequest } from "./types.js";
import { sampleActingPrimitive } from "./primitives.js";

const boneNames = [
  "Hips",
  "Spine",
  "Chest",
  "Neck",
  "Head",
  "LeftShoulder",
  "LeftUpperArm",
  "LeftLowerArm",
  "RightShoulder",
  "RightUpperArm",
  "RightLowerArm",
] as const;

const finiteActions: readonly {
  request: ActingActionRequest;
  targetTime: number;
}[] = [
  { request: { action: "look_left", duration: 1 }, targetTime: 0.5 },
  { request: { action: "look_right", duration: 1 }, targetTime: 0.5 },
  { request: { action: "head_tilt", duration: 1 }, targetTime: 0.5 },
  { request: { action: "nod", duration: 1 }, targetTime: 0.25 },
  { request: { action: "shake_head", duration: 1 }, targetTime: 0.25 },
  { request: { action: "wave", duration: 1 }, targetTime: 0.5 },
  { request: { action: "small_wave", duration: 1 }, targetTime: 0.5 },
  { request: { action: "bow", duration: 1 }, targetTime: 0.5 },
  { request: { action: "shrug", duration: 1 }, targetTime: 0.5 },
  { request: { action: "recoil", duration: 1 }, targetTime: 0.25 },
  { request: { action: "body_lean", duration: 1 }, targetTime: 0.5 },
];

function sample(
  request: ActingActionRequest,
  elapsed: number,
  contextDuration = request.duration ?? Infinity,
) {
  return sampleActingPrimitive(
    request,
    { elapsed, duration: contextDuration },
    boneNames,
  );
}

function isIdentity(rotation: { x: number; y: number; z: number; w: number }): boolean {
  return (
    Math.abs(rotation.x) < 1e-8 &&
    Math.abs(rotation.y) < 1e-8 &&
    Math.abs(rotation.z) < 1e-8 &&
    Math.abs(rotation.w - 1) < 1e-8
  );
}

function hasNonNeutralRotation(
  pose: Record<string, { x: number; y: number; z: number; w: number }>,
): boolean {
  return Object.values(pose).some((rotation) => !isIdentity(rotation));
}

function lengthOf(rotation: { x: number; y: number; z: number; w: number }): number {
  return Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w);
}

function rotationAngle(rotation: { w: number }): number {
  return 2 * Math.acos(Math.min(1, Math.abs(rotation.w)));
}

describe("sampleActingPrimitive", () => {
  it.each(finiteActions)(
    "samples $request.action away from neutral and returns at its endpoint",
    ({ request, targetTime }) => {
      const target = sample(request, targetTime);
      const endpoint = sample(request, request.duration!);

      expect(Object.keys(target)).toEqual(boneNames);
      expect(hasNonNeutralRotation(target)).toBe(true);
      expect(
        Object.values(target).every(
          (rotation) => Math.abs(lengthOf(rotation) - 1) < 1e-8,
        ),
      ).toBe(true);
      expect(Object.values(endpoint).every(isIdentity)).toBe(true);
    },
  );

  it("keeps idle continuous with bounded non-neutral motion", () => {
    const pose = sample({ action: "idle" }, 0.25);

    expect(hasNonNeutralRotation(pose)).toBe(true);
    expect(Math.abs(pose.Head.x)).toBeLessThanOrEqual(Math.sin(0.025) + 1e-8);
    expect(Math.abs(pose.Chest.z)).toBeLessThanOrEqual(Math.sin(0.025) + 1e-8);
  });

  it("returns a finite idle action to neutral at its endpoint", () => {
    const request = { action: "idle", duration: 1 } as const;

    expect(hasNonNeutralRotation(sample(request, 0.25))).toBe(true);
    expect(Object.values(sample(request, 1)).every(isIdentity)).toBe(true);
  });

  it("uses shake_head speed as a frequency input and keeps every speed neutral at the endpoint", () => {
    const slow = { action: "shake_head", duration: 1, speed: 0.1 } as const;
    const fast = { action: "shake_head", duration: 1, speed: 4 } as const;

    for (const elapsed of [0.2, 0.35]) {
      expect(sample(slow, elapsed).Head.y).not.toBeCloseTo(
        sample(fast, elapsed).Head.y,
        6,
      );
    }
    expect(Object.values(sample(slow, 1)).every(isIdentity)).toBe(true);
    expect(Object.values(sample(fast, 1)).every(isIdentity)).toBe(true);
  });

  it("keeps look_camera at the neutral camera pose", () => {
    expect(
      Object.values(sample({ action: "look_camera", duration: 1 }, 0.5)).every(
        isIdentity,
      ),
    ).toBe(true);
  });

  it("uses the bounded numeric primitive defaults", () => {
    expect(
      rotationAngle(sample({ action: "look_left", duration: 1 }, 0.5).Head),
    ).toBeCloseTo(0.35);
    expect(
      rotationAngle(sample({ action: "head_tilt", duration: 1 }, 0.5).Head),
    ).toBeCloseTo(0.26);
    expect(rotationAngle(sample({ action: "nod", duration: 1 }, 0.5).Head)).toBeCloseTo(
      0.22,
    );
    expect(
      rotationAngle(sample({ action: "shake_head", duration: 1 }, 0.25).Head),
    ).toBeCloseTo(0.3);

    const wave = sample({ action: "wave", duration: 1 }, 0.5);
    expect(rotationAngle(wave.RightUpperArm)).toBeCloseTo((Math.PI * 5) / 6);
    expect(rotationAngle(wave.RightLowerArm)).toBeCloseTo(0.35);
    const smallWave = sample({ action: "small_wave", duration: 1 }, 0.5);
    expect(rotationAngle(smallWave.RightUpperArm)).toBeCloseTo(Math.PI / 2);
    expect(rotationAngle(smallWave.RightLowerArm)).toBeCloseTo(0.18);
    expect(
      rotationAngle(sample({ action: "bow", duration: 1 }, 0.5).Spine),
    ).toBeCloseTo(0.3);
    expect(
      rotationAngle(sample({ action: "shrug", duration: 1 }, 0.5).LeftShoulder),
    ).toBeCloseTo(0.22);
    expect(
      rotationAngle(sample({ action: "body_lean", duration: 1 }, 0.5).Spine),
    ).toBeCloseTo(0.24);
    expect(
      rotationAngle(sample({ action: "recoil", duration: 1 }, 0.5).Chest),
    ).toBeLessThanOrEqual(0.2);
    const idle = sample({ action: "idle" }, 0.25);
    expect(rotationAngle(idle.Head)).toBeLessThanOrEqual(0.05);
    expect(rotationAngle(idle.Chest)).toBeLessThanOrEqual(0.05);
  });

  it("rejects invalid duration, blend duration, and request/context duration combinations", () => {
    expect(() => sample({ action: "bow", duration: 0.049 }, 0.01)).toThrow("duration");
    expect(() => sample({ action: "bow", duration: 30.01 }, 0.01)).toThrow("duration");
    expect(() => sample({ action: "idle", duration: Infinity }, 0.01)).toThrow(
      "duration",
    );
    expect(() => sample({ action: "bow", blendDuration: 0.09 }, 0.01)).toThrow(
      "blendDuration",
    );
    expect(() => sample({ action: "bow", blendDuration: 0.31 }, 0.01)).toThrow(
      "blendDuration",
    );
    expect(() => sample({ action: "bow", speed: 0.09 }, 0.01)).toThrow("speed");
    expect(() => sample({ action: "bow", intensity: Infinity }, 0.01)).toThrow(
      "intensity",
    );
    expect(() => sample({ action: "bow", duration: 1 }, 0.01, 0.5)).toThrow(
      "context.duration",
    );
    expect(() => sample({ action: "idle" }, 0.01, 1)).toThrow("context.duration");
  });

  it("accepts inclusive duration and blend-duration boundaries", () => {
    expect(() =>
      sample({ action: "bow", duration: 0.05, blendDuration: 0.1 }, 0.01),
    ).not.toThrow();
    expect(() =>
      sample({ action: "bow", duration: 30, blendDuration: 0.3 }, 0.01),
    ).not.toThrow();
  });

  it("mirrors look and head tilt directions", () => {
    const lookLeft = sample({ action: "look_left", duration: 1 }, 0.5);
    const lookRight = sample({ action: "look_right", duration: 1 }, 0.5);
    const tiltLeft = sample({ action: "head_tilt", side: "left", duration: 1 }, 0.5);
    const tiltRight = sample({ action: "head_tilt", side: "right", duration: 1 }, 0.5);

    expect(lookLeft.Head.y).toBeCloseTo(-lookRight.Head.y);
    expect(lookLeft.Head.w).toBeCloseTo(lookRight.Head.w);
    expect(tiltLeft.Head.z).toBeCloseTo(-tiltRight.Head.z);
    expect(tiltLeft.Head.w).toBeCloseTo(tiltRight.Head.w);
  });

  it("applies a wave only to the selected arm", () => {
    const left = sample({ action: "wave", side: "left", duration: 1 }, 0.5);
    const right = sample({ action: "wave", side: "right", duration: 1 }, 0.5);

    expect(isIdentity(left.LeftUpperArm)).toBe(false);
    expect(isIdentity(left.LeftLowerArm)).toBe(false);
    expect(isIdentity(left.RightUpperArm)).toBe(true);
    expect(isIdentity(left.RightLowerArm)).toBe(true);
    expect(isIdentity(right.RightUpperArm)).toBe(false);
    expect(isIdentity(right.RightLowerArm)).toBe(false);
    expect(isIdentity(right.LeftUpperArm)).toBe(true);
    expect(isIdentity(right.LeftLowerArm)).toBe(true);
  });

  it.each(["wave", "small_wave"] as const)(
    "mirrors %s arm rotations on signed Z and selects both arms when requested",
    (action) => {
      const left = sample({ action, side: "left", duration: 1 }, 0.5);
      const right = sample({ action, side: "right", duration: 1 }, 0.5);
      const both = sample({ action, side: "both", duration: 1 }, 0.5);

      expect(left.LeftUpperArm!.x).toBeCloseTo(0);
      expect(left.LeftUpperArm!.y).toBeCloseTo(0);
      expect(right.RightUpperArm!.x).toBeCloseTo(0);
      expect(right.RightUpperArm!.y).toBeCloseTo(0);
      expect(left.LeftUpperArm!.z).toBeLessThan(0);
      expect(right.RightUpperArm!.z).toBeGreaterThan(0);
      expect(left.LeftUpperArm!.z).toBeCloseTo(-right.RightUpperArm!.z);
      expect(left.LeftLowerArm.z).toBeCloseTo(-right.RightLowerArm.z);
      expect(isIdentity(both.LeftUpperArm)).toBe(false);
      expect(isIdentity(both.RightUpperArm)).toBe(false);
      expect(isIdentity(both.LeftLowerArm)).toBe(false);
      expect(isIdentity(both.RightLowerArm)).toBe(false);
    },
  );

  it("selects and mirrors shrug sides", () => {
    const left = sample({ action: "shrug", side: "left", duration: 1 }, 0.5);
    const right = sample({ action: "shrug", side: "right", duration: 1 }, 0.5);

    expect(isIdentity(left.LeftShoulder)).toBe(false);
    expect(isIdentity(left.RightShoulder)).toBe(true);
    expect(left.LeftUpperArm!.x).toBeCloseTo(0);
    expect(left.LeftUpperArm!.y).toBeCloseTo(0);
    expect(right.RightUpperArm!.x).toBeCloseTo(0);
    expect(right.RightUpperArm!.y).toBeCloseTo(0);
    expect(left.LeftUpperArm!.z).toBeLessThan(0);
    expect(right.RightUpperArm!.z).toBeGreaterThan(0);
    expect(left.LeftUpperArm!.z).toBeCloseTo(-right.RightUpperArm!.z);
    expect(left.LeftShoulder.z).toBeCloseTo(-right.RightShoulder.z);
    expect(isIdentity(right.LeftShoulder)).toBe(true);
  });

  it("mirrors body_lean sides", () => {
    const left = sample({ action: "body_lean", side: "left", duration: 1 }, 0.5);
    const right = sample({ action: "body_lean", side: "right", duration: 1 }, 0.5);

    expect(left.Spine.z).toBeCloseTo(-right.Spine.z);
    expect(left.Chest.z).toBeCloseTo(-right.Chest.z);
  });

  it("clamps intensity to the neutral and full-strength bounds", () => {
    const neutral = sample({ action: "bow", intensity: -1, duration: 1 }, 0.5);
    const clamped = sample({ action: "bow", intensity: 10, duration: 1 }, 0.5);
    const full = sample({ action: "bow", intensity: 1, duration: 1 }, 0.5);

    expect(Object.values(neutral).every(isIdentity)).toBe(true);
    expect(clamped).toEqual(full);
  });
});
