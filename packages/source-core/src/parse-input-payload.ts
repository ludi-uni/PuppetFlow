import type {
  ChannelStore,
  ChannelValue,
  StateStore,
  StateValue,
  TimelineEvent,
} from "@puppetflow/core";
import type { TimelineStore } from "@puppetflow/core";
import { applyStatePayload } from "./parse-state-payload.js";

export const MAX_TIMELINE_EVENTS_PER_PAYLOAD = 64;
export const MAX_CHANNEL_KEYS_PER_PAYLOAD = 128;

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
  return (
    typeof event.startMs === "number" &&
    typeof event.endMs === "number" &&
    typeof event.type === "string"
  );
}

export interface InputPayloadTarget {
  state: StateStore;
  channels: ChannelStore;
  timeline: TimelineStore;
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

  if (record.state && typeof record.state === "object" && record.state !== null) {
    applyStatePayload(target.state, record.state, fieldMapping);
  } else if (!("channels" in record) && !("timeline" in record)) {
    applyStatePayload(target.state, record, fieldMapping);
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
}
