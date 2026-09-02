import {
  normalizeMotionFrame,
  type MotionFrame,
  type MotionState,
  type Quaternion,
} from "@puppetflow/core";

import { composeBoneRotation, quaternionFromEuler } from "./rotation.js";
import { ExpressionEngine } from "./expression-engine.js";
import { ActingScheduler, type ActingSchedulerOptions } from "./scheduler.js";
import type {
  ActingActionName,
  ActingActionParams,
  ActingBoneProfile,
  ActingCommandResult,
  ActingActionRequest,
  ActingExpressionName,
  ActingExpressionParams,
  ActingExpressionProfile,
  ActingExpressionState,
  ActingRuntimeApi,
  ActingState,
  ExpressionCommandResult,
} from "./types.js";

export interface ActingEngineOptions extends ActingSchedulerOptions {
  profile: ActingBoneProfile;
  expressionProfile?: ActingExpressionProfile;
}

/** Synchronously converts rendered motion and procedural offsets into a local bone frame. */
export class ActingEngine implements ActingRuntimeApi {
  private readonly scheduler: ActingScheduler;
  private readonly expressionEngine: ExpressionEngine | undefined;
  private timestamp = 0;

  constructor(private readonly options: ActingEngineOptions) {
    this.scheduler = new ActingScheduler(
      options.profile.bones.map((bone) => bone.name),
      options,
    );
    this.expressionEngine = options.expressionProfile
      ? new ExpressionEngine({ profile: options.expressionProfile })
      : undefined;
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
    const state = this.scheduler.get_state();
    const expression = this.expressionEngine?.get_expression_state();
    return {
      ...state,
      ...(expression === undefined
        ? {}
        : { expression: cloneExpressionState(expression) }),
    };
  }

  set_expression(
    expression: ActingExpressionName | string,
    params?: ActingExpressionParams,
  ): ActingCommandResult {
    if (this.expressionEngine === undefined) {
      return this.rejectExpressionCommand();
    }
    const result = this.expressionEngine.set_expression(expression, params);
    return this.expressionCommandResult(result);
  }

  clear_expression(params?: { fadeOut?: number }): ActingCommandResult {
    if (this.expressionEngine === undefined) {
      return this.rejectExpressionCommand();
    }
    const result = this.expressionEngine.clear_expression(params);
    return this.expressionCommandResult(result);
  }

  get_expression_state(): ActingExpressionState {
    return cloneExpressionState(
      this.expressionEngine?.get_expression_state() ?? EMPTY_EXPRESSION_STATE,
    );
  }

  reset(): void {
    this.scheduler.reset();
    this.expressionEngine?.reset();
  }

  tick(deltaTime: number, baseMotion: MotionState): MotionFrame {
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new RangeError("Acting deltaTime must be finite and non-negative");
    }
    this.timestamp += deltaTime * 1000;
    const offsets = this.scheduler.tick(deltaTime);
    const expressionValues = this.expressionEngine?.tick(deltaTime);
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
      ...(expressionValues && Object.keys(expressionValues).length > 0
        ? { blendShapes: expressionValues }
        : {}),
      metadata: {
        sourceId: "acting",
        sourceType: "procedural-acting",
        coordinateSpace: "local",
        clock: "monotonic",
      },
    });
  }

  private rejectExpressionCommand(): ActingCommandResult {
    return this.expressionCommandResult({
      accepted: false,
      reason: "No Expression profile is configured",
    });
  }

  private expressionCommandResult(
    result: Pick<ExpressionCommandResult, "accepted" | "reason">,
  ): ActingCommandResult {
    return {
      accepted: result.accepted,
      ...(result.reason === undefined ? {} : { reason: result.reason }),
      state: this.get_state(),
    };
  }
}

const IDENTITY_ROTATION: Quaternion = { x: 0, y: 0, z: 0, w: 1 };
const EMPTY_EXPRESSION_STATE: ActingExpressionState = {
  elapsed: 0,
  remaining: 0,
  fadeRemaining: 0,
};

function cloneExpressionState(state: ActingExpressionState): ActingExpressionState {
  return {
    ...(state.activeExpression === undefined
      ? {}
      : { activeExpression: { ...state.activeExpression } }),
    ...(state.activeExpressionId === undefined
      ? {}
      : { activeExpressionId: state.activeExpressionId }),
    elapsed: state.elapsed,
    remaining: state.remaining,
    fadeRemaining: state.fadeRemaining,
  };
}

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
