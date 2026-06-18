import type {
  MicroBehaviorDefinition,
  MicroBehaviorKeyframe,
  MicroBehaviorRandomRange,
  MicroBehaviorRequest,
} from "./types.js";
import { isKnownBehaviorId } from "./registry.js";

export const MAX_BEHAVIOR_ID_LENGTH = 64;
export const MAX_BEHAVIOR_KEYFRAMES = 32;
export const MAX_BEHAVIOR_DURATION = 30;
export const MAX_BEHAVIOR_COOLDOWN = 300;

const BEHAVIOR_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;

export const BEHAVIOR_INPUT_KEYS = new Set([
  "behavior",
  "definition",
  "behaviorDefinition",
  "strength",
]);

export function isValidBehaviorId(value: string): boolean {
  return value.length > 0 && value.length <= MAX_BEHAVIOR_ID_LENGTH && BEHAVIOR_ID_PATTERN.test(value);
}

function parseKeyframe(value: unknown, index: number): MicroBehaviorKeyframe {
  if (typeof value !== "object" || value === null) {
    throw new Error(`keyframes[${index}] must be an object`);
  }

  const frame = value as Partial<MicroBehaviorKeyframe>;
  if (typeof frame.t !== "number" || !Number.isFinite(frame.t) || frame.t < 0) {
    throw new Error(`keyframes[${index}].t must be a non-negative number`);
  }

  if (typeof frame.params !== "object" || frame.params === null) {
    throw new Error(`keyframes[${index}].params must be an object`);
  }

  const params: Record<string, number> = {};
  for (const [key, paramValue] of Object.entries(frame.params)) {
    if (typeof paramValue !== "number" || !Number.isFinite(paramValue)) {
      throw new Error(`keyframes[${index}].params.${key} must be a number`);
    }
    params[key] = paramValue;
  }

  return { t: frame.t, params };
}

function parseRandomRange(
  value: unknown,
  path: string,
): MicroBehaviorRandomRange | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "object" || value === null) {
    throw new Error(`${path} must be an object`);
  }

  const range = value as Partial<MicroBehaviorRandomRange>;
  if (typeof range.min !== "number" || typeof range.max !== "number") {
    throw new Error(`${path}.min and ${path}.max must be numbers`);
  }

  return { min: range.min, max: range.max };
}

export function parseBehaviorDefinitionInput(
  id: string,
  value: unknown,
): MicroBehaviorDefinition {
  if (typeof value !== "object" || value === null) {
    throw new Error("behavior definition must be an object");
  }

  const input = value as Partial<MicroBehaviorDefinition>;
  if (typeof input.duration !== "number" || input.duration <= 0 || input.duration > MAX_BEHAVIOR_DURATION) {
    throw new Error(`behavior duration must be > 0 and <= ${MAX_BEHAVIOR_DURATION}`);
  }

  const cooldown = input.cooldown ?? 0;
  if (typeof cooldown !== "number" || cooldown < 0 || cooldown > MAX_BEHAVIOR_COOLDOWN) {
    throw new Error(`behavior cooldown must be >= 0 and <= ${MAX_BEHAVIOR_COOLDOWN}`);
  }

  if (!Array.isArray(input.keyframes) || input.keyframes.length === 0) {
    throw new Error("behavior keyframes must be a non-empty array");
  }

  if (input.keyframes.length > MAX_BEHAVIOR_KEYFRAMES) {
    throw new Error(`behavior keyframes exceed max (${MAX_BEHAVIOR_KEYFRAMES})`);
  }

  const keyframes = input.keyframes.map((frame, index) => parseKeyframe(frame, index));

  const paramRandom: Record<string, MicroBehaviorRandomRange> = {};
  if (input.paramRandom) {
    for (const [key, rangeValue] of Object.entries(input.paramRandom)) {
      const range = parseRandomRange(rangeValue, `paramRandom.${key}`);
      if (range) {
        paramRandom[key] = range;
      }
    }
  }

  return {
    id,
    duration: input.duration,
    cooldown,
    keyframes,
    paramRandom: Object.keys(paramRandom).length > 0 ? paramRandom : undefined,
    durationRandom: parseRandomRange(input.durationRandom, "durationRandom"),
  };
}

function readDefinitionField(record: Record<string, unknown>): unknown {
  return record.definition ?? record.behaviorDefinition;
}

export function parseBehaviorRequest(value: unknown): MicroBehaviorRequest | null {
  if (typeof value === "string") {
    if (!isValidBehaviorId(value)) {
      return null;
    }
    return { behavior: value };
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.behavior !== "string" || !isValidBehaviorId(record.behavior)) {
    return null;
  }

  const request: MicroBehaviorRequest = { behavior: record.behavior };

  if (typeof record.strength === "number" && Number.isFinite(record.strength)) {
    request.strength = record.strength;
  }

  const definitionInput = readDefinitionField(record);
  if (definitionInput !== undefined) {
    request.definition = parseBehaviorDefinitionInput(record.behavior, definitionInput);
  }

  return request;
}

export function parseBehaviorInputPayload(payload: unknown): MicroBehaviorRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (record.type === "behavior") {
    if (record.behavior !== undefined) {
      return parseBehaviorRequest(record);
    }
    if (record.payload !== undefined) {
      return parseBehaviorRequest(record.payload);
    }
  }

  if (record.behavior !== undefined) {
    return parseBehaviorRequest(record);
  }

  return null;
}

export function canResolveBehaviorRequest(
  request: MicroBehaviorRequest,
  hasBehavior: (id: string) => boolean,
): boolean {
  if (request.definition) {
    return true;
  }
  return hasBehavior(request.behavior);
}

export function isKnownBehaviorRequest(
  request: MicroBehaviorRequest,
): boolean {
  return canResolveBehaviorRequest(request, isKnownBehaviorId);
}
