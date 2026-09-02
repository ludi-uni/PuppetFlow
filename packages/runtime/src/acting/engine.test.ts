import { createEmptyMotionState } from "@puppetflow/core";
import { describe, expect, it } from "vitest";

import {
  ActingEngine as PublicActingEngine,
  ActingScheduler as PublicActingScheduler,
  type ActingEngineOptions,
  type ActingSchedulerOptions,
} from "../index.js";
import { ActingEngine } from "./engine.js";
import { quaternionFromEuler } from "./rotation.js";
import type { ActingBoneProfile, ActingExpressionProfile } from "./types.js";

const PROFILE: ActingBoneProfile = {
  id: "test-profile",
  bones: [
    { name: "Hips", position: { x: 0, y: 1, z: 0 } },
    { name: "Spine", position: { x: 0, y: 1.2, z: 0 } },
    { name: "Chest", position: { x: 0, y: 1.4, z: 0 } },
    { name: "Neck", position: { x: 0, y: 1.6, z: 0 } },
    { name: "Head", position: { x: 0, y: 1.8, z: 0 } },
    { name: "RightUpperArm", position: { x: 0.2, y: 1.5, z: 0 } },
    { name: "RightLowerArm", position: { x: 0.5, y: 1.5, z: 0 } },
  ],
};

const EXPRESSION_PROFILE: ActingExpressionProfile = {
  id: "engine-expressions",
  expressions: { happy: { blendShape: "Joy" } },
};

describe("ActingEngine", () => {
  it("maps rendered MotionState head and body channels to local bone rotations", () => {
    const engine = new ActingEngine({ profile: PROFILE });
    const motion = {
      ...createEmptyMotionState(),
      faceYaw: 1,
      facePitch: 0,
      headTilt: 1,
      bodyYaw: 1,
      bodyRoll: 0,
      bodyLean: 1,
    };

    const frame = engine.tick(0, motion);

    expect(frame.bones?.Head?.rotation).toEqual(
      quaternionFromEuler({ x: -0.25, y: 0.35, z: 0.25 }),
    );
    expect(frame.bones?.Spine?.rotation).toEqual(
      quaternionFromEuler({ x: 0.2, y: 0.3, z: -0.25 }),
    );
  });

  it("emits every profile bone with static positions, normalized rotations, and metadata", () => {
    const engine = new ActingEngine({ profile: PROFILE });

    const frame = engine.tick(0.1, createEmptyMotionState());

    expect(frame).toMatchObject({
      timestamp: 100,
      metadata: {
        sourceId: "acting",
        sourceType: "procedural-acting",
        coordinateSpace: "local",
        clock: "monotonic",
      },
    });
    expect(Object.keys(frame.bones ?? {})).toEqual(
      PROFILE.bones.map((bone) => bone.name),
    );
    for (const bone of PROFILE.bones) {
      const transform = frame.bones?.[bone.name];
      expect(transform?.position).toEqual(bone.position);
      const rotation = transform?.rotation;
      expect(rotation).toBeDefined();
      if (rotation === undefined) {
        throw new Error(`Missing rotation for ${bone.name}`);
      }
      expect(Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w)).toBeCloseTo(1);
    }
  });

  it.each([
    ["wave", "RightUpperArm"],
    ["bow", "Spine"],
    ["body_lean", "Spine"],
  ] as const)("adds %s offsets to %s", (action, boneName) => {
    const engine = new ActingEngine({ profile: PROFILE });
    engine.act(action, { duration: 1 });

    const frame = engine.tick(0.5, createEmptyMotionState());

    expect(frame.bones?.[boneName]?.rotation).not.toEqual({ x: 0, y: 0, z: 0, w: 1 });
  });

  it("resets scheduler state without moving the monotonic frame clock backward", () => {
    const engine = new ActingEngine({ profile: PROFILE });
    engine.act("wave", { duration: 1 });
    expect(engine.tick(1, createEmptyMotionState()).timestamp).toBe(1000);

    engine.reset();

    expect(engine.get_state().activeAction).toBeUndefined();
    expect(engine.tick(0.1, createEmptyMotionState()).timestamp).toBe(1100);
  });

  it("returns to configured idle when reset", () => {
    const engine = new ActingEngine({ profile: PROFILE, autoIdle: true });
    engine.act("wave", { duration: 1 });

    engine.reset();

    expect(engine.get_state().activeAction).toEqual({ action: "idle" });
  });

  it("emits Body bones and Expression blendshapes in one frame with one clock", () => {
    const engine = new ActingEngine({
      profile: PROFILE,
      expressionProfile: EXPRESSION_PROFILE,
    });
    engine.act("wave", { duration: 1 });
    engine.set_expression("happy", { intensity: 0.5, fadeIn: 0 });

    const frame = engine.tick(0.1, createEmptyMotionState());

    expect(frame.timestamp).toBe(100);
    expect(frame.bones?.RightUpperArm).toBeDefined();
    expect(frame.blendShapes).toEqual({ Joy: 0.5 });
  });

  it("keeps Expression active when Body is interrupted and keeps Body active when Expression clears", () => {
    const engine = new ActingEngine({
      profile: PROFILE,
      expressionProfile: EXPRESSION_PROFILE,
    });
    engine.act("wave", { duration: 1 });
    engine.set_expression("happy", { intensity: 0.5, fadeIn: 0 });

    engine.interrupt();
    expect(engine.get_state().expression?.activeExpression?.expression).toBe("happy");

    engine.act("bow", { duration: 1 });
    engine.clear_expression({ fadeOut: 0 });
    expect(engine.get_state().activeAction?.action).toBe("bow");
  });

  it("rejects Expression commands when no profile is configured", () => {
    const engine = new ActingEngine({ profile: PROFILE });
    const result = engine.set_expression("happy");

    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/profile/i);
  });

  it("exports the scheduler and engine contracts from the package root", () => {
    const schedulerOptions: ActingSchedulerOptions = { autoIdle: false };
    const engineOptions: ActingEngineOptions = { profile: PROFILE, autoIdle: true };

    expect(PublicActingEngine).toBe(ActingEngine);
    expect(PublicActingScheduler.name).toBe("ActingScheduler");
    expect(schedulerOptions.autoIdle).toBe(false);
    expect(engineOptions.profile).toBe(PROFILE);
  });
});
