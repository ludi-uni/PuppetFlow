import {
  normalizeMotionFrame,
  type MotionFrame,
  type MotionState,
  type Quaternion,
} from "@puppetflow/core";

import { composeBoneRotation, quaternionFromEuler } from "./rotation.js";
import { ActingScheduler, type ActingSchedulerOptions } from "./scheduler.js";
import type {
  ActingActionName,
  ActingActionParams,
  ActingApi,
  ActingBoneProfile,
  ActingCommandResult,
  ActingActionRequest,
  ActingState,
} from "./types.js";

export interface ActingEngineOptions extends ActingSchedulerOptions {
  profile: ActingBoneProfile;
}

/** Synchronously converts rendered motion and procedural offsets into a local bone frame. */
export class ActingEngine implements ActingApi {
  private readonly scheduler: ActingScheduler;
  private timestamp = 0;

  constructor(private readonly options: ActingEngineOptions) {
    this.scheduler = new ActingScheduler(
      options.profile.bones.map((bone) => bone.name),
      options,
    );
  }

  act(
    action: ActingActionName | string,
    params?: ActingActionParams,
  ): ActingCommandResult {
    return this.scheduler.act(action, params);
  }

  sequence(actions: readonly ActingActionRequest[]): ActingCommandResult {
    return this.scheduler.sequence(actions);
  }

  interrupt(): ActingCommandResult {
    return this.scheduler.interrupt();
  }

  get_state(): ActingState {
    return this.scheduler.get_state();
  }

  reset(): void {
    this.scheduler.reset();
  }

  tick(deltaTime: number, baseMotion: MotionState): MotionFrame {
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new RangeError("Acting deltaTime must be finite and non-negative");
    }
    this.timestamp += deltaTime * 1000;
    const offsets = this.scheduler.tick(deltaTime);
    const bones = Object.fromEntries(
      this.options.profile.bones.map((bone) => {
        const baseRotation = baseRotationFor(bone.name, baseMotion);
        const neutralRotation = bone.neutralRotation ?? IDENTITY_ROTATION;
        const offset = offsets[bone.name] ?? IDENTITY_ROTATION;
        return [
          bone.name,
          {
            position: { ...bone.position },
            rotation: composeBoneRotation(
              composeBoneRotation(neutralRotation, baseRotation),
              offset,
            ),
          },
        ];
      }),
    );

    return normalizeMotionFrame({
      timestamp: this.timestamp,
      bones,
      metadata: {
        sourceId: "acting",
        sourceType: "procedural-acting",
        coordinateSpace: "local",
        clock: "monotonic",
      },
    });
  }
}

const IDENTITY_ROTATION: Quaternion = { x: 0, y: 0, z: 0, w: 1 };

function baseRotationFor(boneName: string, motion: MotionState): Quaternion {
  const head = {
    x: centered(motion.facePitch) * 0.5,
    y: centered(motion.faceYaw) * 0.7,
    z: centered(motion.headTilt) * 0.5,
  };
  const body = {
    x: centered(motion.bodyLean) * 0.4,
    y: centered(motion.bodyYaw) * 0.6,
    z: centered(motion.bodyRoll) * 0.5,
  };
  switch (boneName) {
    case "Head":
      return quaternionFromEuler(head);
    case "Neck":
      return quaternionFromEuler(scaleEuler(head, 0.5));
    case "Spine":
      return quaternionFromEuler(body);
    case "Chest":
      return quaternionFromEuler(scaleEuler(body, 0.5));
    default:
      return IDENTITY_ROTATION;
  }
}

function centered(value: number): number {
  return value - 0.5;
}

function scaleEuler(
  euler: Readonly<{ x: number; y: number; z: number }>,
  factor: number,
): { x: number; y: number; z: number } {
  return { x: euler.x * factor, y: euler.y * factor, z: euler.z * factor };
}
