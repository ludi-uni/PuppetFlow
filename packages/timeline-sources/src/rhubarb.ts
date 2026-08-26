import type { TimelineEvent } from "@puppetflow/core";
import { TimelineSourceParseError } from "./errors.js";
import type { TimelineSource, TimelineSourceOptions } from "./types.js";
import {
  addOffset,
  optionalFiniteNumber,
  parseOffsetMs,
  requireArray,
  requireFiniteNumber,
  requireRecord,
} from "./validation.js";

const SOURCE_ID = "rhubarb" as const;
const SHAPES = new Set(["A", "B", "C", "D", "E", "F", "G", "H", "X"]);

export function parseRhubarbJson(
  input: unknown,
  options?: TimelineSourceOptions,
): readonly TimelineEvent[] {
  const root = requireRecord(SOURCE_ID, "input", input);
  const offsetMs = parseOffsetMs(SOURCE_ID, options);
  const cues = requireArray(SOURCE_ID, "mouthCues", root.mouthCues);

  if (root.metadata !== undefined) {
    const metadata = requireRecord(SOURCE_ID, "metadata", root.metadata);
    optionalFiniteNumber(SOURCE_ID, "metadata.duration", metadata.duration, 0);
  }

  const events: TimelineEvent[] = [];
  let previousEndSeconds = 0;
  let previousEndMs: number | undefined;

  for (const [index, rawCue] of cues.entries()) {
    const path = `mouthCues[${index}]`;
    const cue = requireRecord(SOURCE_ID, path, rawCue);
    const start = requireFiniteNumber(SOURCE_ID, `${path}.start`, cue.start, 0);
    const end = requireFiniteNumber(SOURCE_ID, `${path}.end`, cue.end, 0);
    const rawShape = cue.value;
    const shape = typeof rawShape === "string" ? rawShape.toUpperCase() : "";

    if (!SHAPES.has(shape)) {
      throw new TimelineSourceParseError(
        SOURCE_ID,
        `${path}.value`,
        "unknown mouth shape",
      );
    }
    if (end <= start || start < previousEndSeconds) {
      throw new TimelineSourceParseError(
        SOURCE_ID,
        `${path}.start`,
        "cue interval is not ordered",
      );
    }

    const startMs = addOffset(
      SOURCE_ID,
      `${path}.start`,
      offsetMs,
      Math.round(start * 1000),
    );
    const endMs = addOffset(SOURCE_ID, `${path}.end`, offsetMs, Math.round(end * 1000));
    if (endMs <= startMs || (previousEndMs !== undefined && startMs < previousEndMs)) {
      throw new TimelineSourceParseError(
        SOURCE_ID,
        `${path}.end`,
        "rounded cue interval is invalid",
      );
    }

    events.push({
      startMs,
      endMs,
      type: "rhubarb-mouth",
      value: { shape },
    });
    previousEndSeconds = end;
    previousEndMs = endMs;
  }

  return events;
}

export const rhubarbJsonSource: TimelineSource<unknown> = {
  id: SOURCE_ID,
  parse: parseRhubarbJson,
};
