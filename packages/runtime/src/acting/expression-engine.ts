import {
  expressionProfileChannels,
  resolveExpressionTarget,
  validateActingExpressionParams,
} from "./expression-profile.js";
import type {
  ActingExpressionName,
  ActingExpressionParams,
  ActingExpressionProfile,
  ActingExpressionRequest,
  ActingExpressionState,
  ExpressionApi,
  ExpressionCommandResult,
} from "./types.js";

const DEFAULT_FADE_IN_SECONDS = 0.15;
const DEFAULT_FADE_OUT_SECONDS = 0.2;

export interface ExpressionEngineOptions {
  profile: ActingExpressionProfile;
  defaultFadeIn?: number;
  defaultFadeOut?: number;
}

/**
 * Synchronously advances semantic expression targets when a caller supplies a frame delta.
 * It owns only the blendshape channels declared by its expression profile.
 */
export class ExpressionEngine implements ExpressionApi {
  private readonly channels: readonly string[];
  private readonly defaultFadeIn: number;
  private readonly defaultFadeOut: number;
  private readonly profile: ActingExpressionProfile;
  private active: ActiveExpression | undefined;
  private current: Record<string, number>;
  private dirty = true;
  private nextExpressionId = 1;

  constructor(options: ExpressionEngineOptions) {
    this.profile = {
      id: options.profile.id,
      expressions: { ...options.profile.expressions },
    };
    this.channels = expressionProfileChannels(this.profile);
    this.defaultFadeIn = options.defaultFadeIn ?? DEFAULT_FADE_IN_SECONDS;
    this.defaultFadeOut = options.defaultFadeOut ?? DEFAULT_FADE_OUT_SECONDS;
    validateActingExpressionParams({
      fadeIn: this.defaultFadeIn,
      fadeOut: this.defaultFadeOut,
    });
    this.current = zeroRecord(this.channels);
  }

  set_expression(
    expression: ActingExpressionName | string,
    params: ActingExpressionParams = {},
  ): ExpressionCommandResult {
    const request: ActingExpressionRequest = { expression, ...params };
    try {
      validateActingExpressionParams(params);
      const fadeIn = params.fadeIn ?? this.defaultFadeIn;
      const fadeOut = params.fadeOut ?? this.defaultFadeOut;
      const duration = params.duration ?? Infinity;
      if (Number.isFinite(duration) && duration < fadeIn + fadeOut) {
        throw new RangeError("Expression duration must cover fadeIn plus fadeOut");
      }

      this.active = {
        id: this.nextExpressionId++,
        request: { ...request },
        elapsed: 0,
        duration,
        fadeIn,
        fadeOut,
        from: cloneRecord(this.current),
        target: this.targetFor(expression, params.intensity ?? 1),
      };
      this.dirty = true;
      return this.accept();
    } catch (error) {
      return this.reject(error instanceof Error ? error.message : "Invalid expression");
    }
  }

  clear_expression(params: { fadeOut?: number } = {}): ExpressionCommandResult {
    try {
      validateActingExpressionParams(params);
      const fadeOut = params.fadeOut ?? this.defaultFadeOut;
      if (
        this.active === undefined &&
        recordsEqual(this.current, zeroRecord(this.channels))
      ) {
        this.dirty = true;
        return this.accept();
      }

      this.active = {
        id: this.nextExpressionId++,
        request: { expression: "neutral", fadeOut },
        elapsed: 0,
        duration: fadeOut,
        fadeIn: 0,
        fadeOut,
        from: cloneRecord(this.current),
        target: zeroRecord(this.channels),
      };
      this.dirty = true;
      return this.accept();
    } catch (error) {
      return this.reject(
        error instanceof Error ? error.message : "Invalid expression clear",
      );
    }
  }

  get_expression_state(): ActingExpressionState {
    const active = this.active;
    return {
      ...(active === undefined ? {} : { activeExpression: { ...active.request } }),
      ...(active === undefined ? {} : { activeExpressionId: active.id }),
      elapsed: active?.elapsed ?? 0,
      remaining: active === undefined ? 0 : remainingFor(active),
      fadeRemaining: active === undefined ? 0 : fadeRemainingFor(active),
    };
  }

  reset(): void {
    this.active = undefined;
    this.current = zeroRecord(this.channels);
    this.dirty = true;
    this.nextExpressionId = 1;
  }

  tick(deltaTime: number): Record<string, number> {
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new RangeError("Expression deltaTime must be finite and non-negative");
    }

    const active = this.active;
    if (active === undefined) {
      if (!this.dirty) {
        return {};
      }
      this.dirty = false;
      return cloneRecord(this.current);
    }

    active.elapsed = Number.isFinite(active.duration)
      ? Math.min(active.duration, active.elapsed + deltaTime)
      : active.elapsed + deltaTime;
    this.current = sampleExpression(active, this.channels);
    this.dirty = false;

    if (Number.isFinite(active.duration) && active.elapsed >= active.duration) {
      this.active = undefined;
    }
    return cloneRecord(this.current);
  }

  private targetFor(
    expression: ActingExpressionName | string,
    intensity: number,
  ): Record<string, number> {
    const target = zeroRecord(this.channels);
    const expressionTarget = resolveExpressionTarget(this.profile, expression);
    if (expressionTarget !== undefined) {
      target[expressionTarget.blendShape] = intensity;
    }
    return target;
  }

  private accept(): ExpressionCommandResult {
    return { accepted: true, state: this.get_expression_state() };
  }

  private reject(reason: string): ExpressionCommandResult {
    return { accepted: false, reason, state: this.get_expression_state() };
  }
}

interface ActiveExpression {
  id: number;
  request: ActingExpressionRequest;
  elapsed: number;
  duration: number;
  fadeIn: number;
  fadeOut: number;
  from: Record<string, number>;
  target: Record<string, number>;
}

function sampleExpression(
  active: ActiveExpression,
  channels: readonly string[],
): Record<string, number> {
  if (Number.isFinite(active.duration) && active.elapsed >= active.duration) {
    return zeroRecord(channels);
  }

  if (active.fadeIn > 0 && active.elapsed < active.fadeIn) {
    return interpolate(
      active.from,
      active.target,
      channels,
      active.elapsed / active.fadeIn,
    );
  }

  const fadeOutStart = active.duration - active.fadeOut;
  if (Number.isFinite(active.duration) && active.elapsed >= fadeOutStart) {
    if (active.fadeOut === 0) {
      return zeroRecord(channels);
    }
    return interpolate(
      active.target,
      zeroRecord(channels),
      channels,
      (active.elapsed - fadeOutStart) / active.fadeOut,
    );
  }

  return cloneRecord(active.target);
}

function interpolate(
  from: Readonly<Record<string, number>>,
  to: Readonly<Record<string, number>>,
  channels: readonly string[],
  progress: number,
): Record<string, number> {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  return Object.fromEntries(
    channels.map((channel) => [
      channel,
      (from[channel] ?? 0) +
        ((to[channel] ?? 0) - (from[channel] ?? 0)) * clampedProgress,
    ]),
  );
}

function zeroRecord(channels: readonly string[]): Record<string, number> {
  return Object.fromEntries(channels.map((channel) => [channel, 0]));
}

function cloneRecord(record: Readonly<Record<string, number>>): Record<string, number> {
  return { ...record };
}

function remainingFor(active: ActiveExpression): number {
  return Number.isFinite(active.duration)
    ? Math.max(0, active.duration - active.elapsed)
    : Infinity;
}

function fadeRemainingFor(active: ActiveExpression): number {
  if (active.fadeIn > 0 && active.elapsed < active.fadeIn) {
    return active.fadeIn - active.elapsed;
  }
  if (
    Number.isFinite(active.duration) &&
    active.fadeOut > 0 &&
    active.elapsed >= active.duration - active.fadeOut
  ) {
    return Math.max(0, active.duration - active.elapsed);
  }
  return 0;
}

function recordsEqual(
  left: Readonly<Record<string, number>>,
  right: Readonly<Record<string, number>>,
): boolean {
  return Object.keys(left).every((key) => left[key] === right[key]);
}
