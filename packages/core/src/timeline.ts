export interface TimelineEvent {
  startMs: number;
  endMs: number;
  type: string;
  value: unknown;
}

export interface LipSyncEvent {
  startMs: number;
  endMs: number;
  phoneme: string;
  strength: number;
}

export function lipSyncEventToTimelineEvent(event: LipSyncEvent): TimelineEvent {
  return {
    startMs: event.startMs,
    endMs: event.endMs,
    type: "phoneme",
    value: {
      phoneme: event.phoneme,
      strength: event.strength,
    },
  };
}
