import { TimelineSourceParseError } from "./errors.js";
import type { TimelineSourceOptions } from "./types.js";

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(sourceId: string, path: string, reason: string): never {
  throw new TimelineSourceParseError(sourceId, path, reason);
}

export function requireRecord(
  sourceId: string,
  path: string,
  value: unknown,
): UnknownRecord {
  return isRecord(value) ? value : fail(sourceId, path, "must be an object");
}

export function requireArray(
  sourceId: string,
  path: string,
  value: unknown,
): unknown[] {
  return Array.isArray(value) ? value : fail(sourceId, path, "must be an array");
}

export function requireFiniteNumber(
  sourceId: string,
  path: string,
  value: unknown,
  minimum: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) {
    return fail(sourceId, path, `must be a finite number >= ${minimum}`);
  }
  return value;
}

export function optionalFiniteNumber(
  sourceId: string,
  path: string,
  value: unknown,
  minimum: number,
): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return requireFiniteNumber(sourceId, path, value, minimum);
}

export function parseOffsetMs(
  sourceId: string,
  options: TimelineSourceOptions | undefined,
): number {
  const offsetMs = options?.offsetMs;
  return offsetMs === undefined
    ? 0
    : requireFiniteNumber(sourceId, "options.offsetMs", offsetMs, 0);
}

export function addOffset(
  sourceId: string,
  path: string,
  offsetMs: number,
  boundaryMs: number,
): number {
  const result = offsetMs + boundaryMs;
  return Number.isFinite(result) && result >= 0
    ? result
    : fail(sourceId, path, "computed boundary is not finite and non-negative");
}
