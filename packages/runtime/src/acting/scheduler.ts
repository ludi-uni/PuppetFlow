import type { Quaternion } from "@puppetflow/core";

import { sampleActingPrimitive } from "./primitives.js";
import { blendBoneRotations, identityPose } from "./rotation.js";
import {
  ACTING_ACTION_NAMES,
  DEFAULT_ACTING_BLEND_DURATION_SECONDS,
  type ActingActionName,
  type ActingActionParams,
  type ActingActionRequest,
  type ActingApi,
  type ActingCommandResult,
  type ActingState,
  validateActingActionParams,
} from "./types.js";

const DEFAULT_ACTION_DURATION_SECONDS = 1;
const MAX_QUEUED_ACTIONS = 32;

export interface ActingSchedulerOptions {
  autoIdle?: boolean;
}

/**
 * Advances procedural acting only when a caller supplies a frame delta.
 * It never starts timers or awaits action completion.
 */
export class ActingScheduler implements ActingApi {
  private readonly autoIdle: boolean;
  private active: ActiveAction | undefined;
  private queue: ActingActionRequest[] = [];
  private nextActionId = 1;
  private nextSequenceId = 1;
  private currentSequenceId: number | undefined;
  private currentPose: Record<string, Quaternion>;
  private blend: BlendState | undefined;

  constructor(
    private readonly boneNames: readonly string[],
    options: ActingSchedulerOptions = {},
  ) {
    this.currentPose = identityPose(boneNames);
    this.autoIdle = options.autoIdle ?? false;
    if (this.autoIdle) {
      this.start({ action: "idle" });
    }
  }

  act(
    action: ActingActionName | string,
    params: ActingActionParams = {},
  ): ActingCommandResult {
    const request: ActingActionRequest = { action, ...params };
    const validationError = validateRequest(request);
    if (validationError !== undefined) {
      return this.reject(validationError);
    }

    this.queue = [];
    this.currentSequenceId = undefined;
    this.start(request);
    return this.accept();
  }

  sequence(actions: readonly ActingActionRequest[]): ActingCommandResult {
    const validationError = validateSequence(actions);
    if (validationError !== undefined) {
      return this.reject(validationError);
    }

    const [first, ...rest] = actions;
    if (first === undefined) {
      return this.reject("Acting sequence must not be empty");
    }
    this.queue = rest.map((request) => ({ ...request }));
    this.currentSequenceId = this.nextSequenceId++;
    this.start(first);
    return this.accept();
  }

  interrupt(): ActingCommandResult {
    this.queue = [];
    this.currentSequenceId = undefined;
    if (this.autoIdle) {
      this.start({ action: "idle" });
    } else {
      this.active = undefined;
      this.blend = undefined;
    }
    return this.accept();
  }

  reset(): void {
    this.queue = [];
    this.active = undefined;
    this.currentSequenceId = undefined;
    this.currentPose = identityPose(this.boneNames);
    this.blend = undefined;
    this.nextActionId = 1;
    this.nextSequenceId = 1;
    if (this.autoIdle) {
      this.start({ action: "idle" });
    }
  }

  get_state(): ActingState {
    const action = this.active;
    return {
      ...(action === undefined ? {} : { activeAction: { ...action.request } }),
      ...(action === undefined ? {} : { activeActionId: action.id }),
      ...(this.currentSequenceId === undefined
        ? {}
        : { sequenceId: this.currentSequenceId }),
      elapsed: action?.elapsed ?? 0,
      remaining: action === undefined ? 0 : remainingFor(action),
      queueLength: this.queue.length,
      blendRemaining: this.blend?.remaining ?? 0,
    };
  }

  tick(deltaTime: number): Record<string, Quaternion> {
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new RangeError("Acting deltaTime must be finite and non-negative");
    }

    const action = this.active;
    if (action === undefined) {
      this.currentPose = identityPose(this.boneNames);
      return this.currentPose;
    }

    action.elapsed += deltaTime;
    const targetPose = this.sample(action);
    this.currentPose = this.applyBlend(targetPose, deltaTime);

    if (!action.continuous && action.elapsed >= action.duration) {
      this.advanceAfterCompletion();
    }

    return this.currentPose;
  }

  private start(request: ActingActionRequest): void {
    const duration = resolveDuration(request);
    const capturedPose = this.currentPose;
    this.active = {
      id: this.nextActionId++,
      request: { ...request },
      elapsed: 0,
      duration,
      continuous: request.action === "idle" && request.duration === undefined,
    };
    const blendDuration =
      request.blendDuration ?? DEFAULT_ACTING_BLEND_DURATION_SECONDS;
    this.blend = {
      from: capturedPose,
      duration: blendDuration,
      remaining: blendDuration,
    };
  }

  private sample(action: ActiveAction): Record<string, Quaternion> {
    return sampleActingPrimitive(
      action.request,
      {
        elapsed: action.elapsed,
        duration: action.continuous ? Infinity : action.duration,
      },
      this.boneNames,
    );
  }

  private applyBlend(
    targetPose: Record<string, Quaternion>,
    deltaTime: number,
  ): Record<string, Quaternion> {
    const blend = this.blend;
    if (blend === undefined) {
      return targetPose;
    }

    blend.remaining = Math.max(0, blend.remaining - deltaTime);
    const weight = 1 - blend.remaining / blend.duration;
    const pose = blendBoneRotations(blend.from, targetPose, this.boneNames, weight);
    if (blend.remaining === 0) {
      this.blend = undefined;
    }
    return pose;
  }

  private advanceAfterCompletion(): void {
    const next = this.queue.shift();
    if (next !== undefined) {
      this.start(next);
      return;
    }
    this.currentSequenceId = undefined;
    if (this.autoIdle) {
      this.start({ action: "idle" });
      return;
    }
    this.active = undefined;
    this.blend = undefined;
  }

  private accept(): ActingCommandResult {
    return { accepted: true, state: this.get_state() };
  }

  private reject(reason: string): ActingCommandResult {
    return { accepted: false, reason, state: this.get_state() };
  }
}

interface ActiveAction {
  id: number;
  request: ActingActionRequest;
  elapsed: number;
  duration: number;
  continuous: boolean;
}

interface BlendState {
  from: Record<string, Quaternion>;
  duration: number;
  remaining: number;
}

function validateSequence(actions: readonly ActingActionRequest[]): string | undefined {
  if (actions.length === 0) {
    return "Acting sequence must not be empty";
  }
  if (actions.length > MAX_QUEUED_ACTIONS + 1) {
    return `Acting sequence must contain at most ${MAX_QUEUED_ACTIONS + 1} actions`;
  }
  for (const request of actions) {
    const validationError = validateRequest(request);
    if (validationError !== undefined) {
      return validationError;
    }
  }
  return undefined;
}

function validateRequest(request: ActingActionRequest): string | undefined {
  if (!ACTING_ACTION_NAMES.includes(request.action as ActingActionName)) {
    return `Unknown acting action: ${request.action}`;
  }
  if (
    request.side !== undefined &&
    request.side !== "left" &&
    request.side !== "right" &&
    request.side !== "both"
  ) {
    return `Invalid acting side: ${request.side}`;
  }
  try {
    validateActingActionParams(request);
    if (request.action === "idle" && request.duration === Infinity) {
      return "Acting idle duration must be omitted for continuous idle";
    }
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid acting action";
  }
  return undefined;
}

function resolveDuration(request: ActingActionRequest): number {
  return request.action === "idle" && request.duration === undefined
    ? Infinity
    : (request.duration ?? DEFAULT_ACTION_DURATION_SECONDS);
}

function remainingFor(action: ActiveAction): number {
  return action.continuous ? Infinity : Math.max(0, action.duration - action.elapsed);
}
