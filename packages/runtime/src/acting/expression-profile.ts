import {
  ACTING_DURATION_MAX_SECONDS,
  ACTING_DURATION_MIN_SECONDS,
  ACTING_EXPRESSION_NAMES,
  type ActingExpressionName,
  type ActingExpressionParams,
  type ActingExpressionProfile,
  type ActingExpressionTarget,
} from "./types.js";

const EXPRESSION_FADE_MIN_SECONDS = 0;
const EXPRESSION_FADE_MAX_SECONDS = 30;

/** Rejects invalid explicit expression parameters before they can alter expression state. */
export function validateActingExpressionParams(params: ActingExpressionParams): void {
  if (params.intensity !== undefined) {
    validateExpressionRange(params.intensity, 0, 1, "intensity");
  }
  if (params.duration !== undefined) {
    validateExpressionRange(
      params.duration,
      ACTING_DURATION_MIN_SECONDS,
      ACTING_DURATION_MAX_SECONDS,
      "duration",
    );
  }
  if (params.fadeIn !== undefined) {
    validateExpressionRange(
      params.fadeIn,
      EXPRESSION_FADE_MIN_SECONDS,
      EXPRESSION_FADE_MAX_SECONDS,
      "fadeIn",
    );
  }
  if (params.fadeOut !== undefined) {
    validateExpressionRange(
      params.fadeOut,
      EXPRESSION_FADE_MIN_SECONDS,
      EXPRESSION_FADE_MAX_SECONDS,
      "fadeOut",
    );
  }
}

/** Rejects invalid profile entries while keeping neutral as the implicit zero target. */
export function validateActingExpressionProfile(
  profile: ActingExpressionProfile,
): void {
  if (typeof profile.id !== "string" || profile.id.trim().length === 0) {
    throw new RangeError("Acting expression profile id must be non-empty");
  }

  for (const [expression, target] of Object.entries(profile.expressions)) {
    if (!isActingExpressionName(expression)) {
      throw new RangeError(`Unknown acting expression mapping: ${expression}`);
    }
    if (expression === "neutral") {
      throw new RangeError("Neutral expression must not define a blendShape mapping");
    }
    if (
      target === undefined ||
      target === null ||
      typeof target.blendShape !== "string" ||
      target.blendShape.trim().length === 0
    ) {
      throw new RangeError(
        `Acting expression ${expression} requires a non-empty blendShape mapping`,
      );
    }
  }
}

/** Returns the blendshape target for a known, explicitly mapped expression. */
export function resolveExpressionTarget(
  profile: ActingExpressionProfile,
  expression: ActingExpressionName | string,
): ActingExpressionTarget | undefined {
  validateActingExpressionProfile(profile);
  if (!isActingExpressionName(expression)) {
    throw new RangeError(`Unknown acting expression: ${expression}`);
  }
  if (expression === "neutral") {
    return undefined;
  }

  const target = profile.expressions[expression];
  if (target === undefined) {
    throw new RangeError(`Acting expression ${expression} requires a mapping`);
  }
  return target;
}

/** Lists the unique blendshape channels referenced by a valid expression profile. */
export function expressionProfileChannels(profile: ActingExpressionProfile): string[] {
  validateActingExpressionProfile(profile);
  const channels = new Set<string>();
  for (const target of Object.values(profile.expressions)) {
    if (target !== undefined) {
      channels.add(target.blendShape);
    }
  }
  return [...channels];
}

function isActingExpressionName(value: string): value is ActingExpressionName {
  return (ACTING_EXPRESSION_NAMES as readonly string[]).includes(value);
}

function validateExpressionRange(
  value: number,
  min: number,
  max: number,
  name: string,
): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(
      `Acting expression ${name} must be finite and within ${min}..${max}`,
    );
  }
}
