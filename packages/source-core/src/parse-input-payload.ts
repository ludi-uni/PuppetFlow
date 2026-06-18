import type {
  ChannelStore,
  ChannelValue,
  StateStore,
  StateValue,
  TimelineEvent,
} from "@puppetflow/core";
import type { TimelineStore } from "@puppetflow/core";
import type { MotionOverrideStore } from "./motion-override-store.js";
import { applyStatePayload } from "./parse-state-payload.js";

export const BEHAVIOR_PAYLOAD_KEYS = new Set([
  "behavior",
  "definition",
  "behaviorDefinition",
  "strength",
  "type",
  "payload",
]);

export const MAX_TIMELINE_EVENTS_PER_PAYLOAD = 64;
export const MAX_CHANNEL_KEYS_PER_PAYLOAD = 128;
export const MAX_TIMELINE_EVENT_DURATION_MS = 300_000;

function isStateValue(value: unknown): value is StateValue {
  return (
    typeof value === "number" || typeof value === "string" || typeof value === "boolean"
  );
}

function isChannelValue(value: unknown): value is ChannelValue {
  return isStateValue(value);
}

function isTimelineEvent(value: unknown): value is TimelineEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const event = value as Partial<TimelineEvent>;
  if (
    typeof event.startMs !== "number" ||
    typeof event.endMs !== "number" ||
    typeof event.type !== "string"
  ) {
    return false;
  }

  if (!Number.isFinite(event.startMs) || !Number.isFinite(event.endMs)) {
    return false;
  }

  if (event.endMs < event.startMs) {
    return false;
  }

  if (event.endMs - event.startMs > MAX_TIMELINE_EVENT_DURATION_MS) {
    return false;
  }

  return true;
}

export interface InputPayloadTarget {
  state: StateStore;
  channels: ChannelStore;
  timeline: TimelineStore;
  motion: MotionOverrideStore;
  microBehavior?: import("./state-source.js").MicroBehaviorInputHandler;
}

export function applyInputPayload(
  target: InputPayloadTarget,
  payload: unknown,
  fieldMapping: Record<string, string> = {},
): void {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Input payload must be a JSON object");
  }

  const record = payload as Record<string, unknown>;

  if (target.microBehavior) {
    target.microBehavior.applyFromInputRecord(record);
  }

  if (record.state && typeof record.state === "object" && record.state !== null) {
    applyStatePayload(target.state, record.state, fieldMapping);
  } else if (
    !("channels" in record) &&
    !("timeline" in record) &&
    !("motion" in record)
  ) {
    const stateRecord = Object.fromEntries(
      Object.entries(record).filter(([key]) => !BEHAVIOR_PAYLOAD_KEYS.has(key)),
    );
    if (Object.keys(stateRecord).length > 0) {
      applyStatePayload(target.state, stateRecord, fieldMapping);
    }
  }

  if (
    record.channels &&
    typeof record.channels === "object" &&
    record.channels !== null
  ) {
    const channelEntries = Object.entries(record.channels);
    if (channelEntries.length > MAX_CHANNEL_KEYS_PER_PAYLOAD) {
      throw new Error(`channels exceed max keys (${MAX_CHANNEL_KEYS_PER_PAYLOAD})`);
    }

    for (const [key, value] of channelEntries) {
      if (!isChannelValue(value)) {
        continue;
      }
      target.channels.set(fieldMapping[key] ?? key, value);
    }
  }

  if (Array.isArray(record.timeline)) {
    if (record.timeline.length > MAX_TIMELINE_EVENTS_PER_PAYLOAD) {
      throw new Error(
        `timeline exceeds max events (${MAX_TIMELINE_EVENTS_PER_PAYLOAD})`,
      );
    }

    for (const item of record.timeline) {
      if (!isTimelineEvent(item)) {
        continue;
      }
      target.timeline.push(item);
    }
  }

  if (record.motion && typeof record.motion === "object" && record.motion !== null) {
    target.motion.applyPayload(record.motion, fieldMapping);
  }
}
