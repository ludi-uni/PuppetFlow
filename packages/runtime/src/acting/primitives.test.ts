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
  { request: { action: "look_camera", duration: 1 }, targetTime: 0.5 },
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

function sample(request: ActingActionRequest, elapsed: number) {
  return sampleActingPrimitive(
    request,
    { elapsed, duration: request.duration ?? Infinity },
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

  it("clamps intensity to the neutral and full-strength bounds", () => {
    const neutral = sample({ action: "bow", intensity: -1, duration: 1 }, 0.5);
    const clamped = sample({ action: "bow", intensity: 10, duration: 1 }, 0.5);
    const full = sample({ action: "bow", intensity: 1, duration: 1 }, 0.5);

    expect(Object.values(neutral).every(isIdentity)).toBe(true);
    expect(clamped).toEqual(full);
  });
});
