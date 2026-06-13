import type { TimelineEvent } from "./timeline.js";

export const DEFAULT_MAX_TIMELINE_EVENTS = 256;

export class TimelineStore {
  private readonly events: TimelineEvent[] = [];
  private readonly gcBufferMs: number;
  private readonly maxEvents: number;

  constructor(options: { gcBufferMs?: number; maxEvents?: number } = {}) {
    this.gcBufferMs = options.gcBufferMs ?? 5000;
    this.maxEvents = options.maxEvents ?? DEFAULT_MAX_TIMELINE_EVENTS;
  }

  push(event: TimelineEvent): void {
    this.events.push({ ...event });
    this.trimToMaxEvents();
  }

  pushMany(events: TimelineEvent[]): void {
    for (const event of events) {
      this.push(event);
    }
  }

  getActiveEvents(currentMs: number): TimelineEvent[] {
    this.gc(currentMs);
    return this.events.filter(
      (event) => event.startMs <= currentMs && currentMs < event.endMs,
    );
  }

  getAll(): readonly TimelineEvent[] {
    return this.events;
  }

  clear(): void {
    this.events.length = 0;
  }

  private trimToMaxEvents(): void {
    if (this.events.length <= this.maxEvents) {
      return;
    }

    this.events.sort((left, right) => left.endMs - right.endMs);
    this.events.splice(0, this.events.length - this.maxEvents);
  }

  private gc(currentMs: number): void {
    const threshold = currentMs - this.gcBufferMs;
    if (threshold <= 0) {
      return;
    }

    let writeIndex = 0;
    for (let readIndex = 0; readIndex < this.events.length; readIndex += 1) {
      const event = this.events[readIndex];
      if (event && event.endMs >= threshold) {
        this.events[writeIndex] = event;
        writeIndex += 1;
      }
    }
    this.events.length = writeIndex;
  }
}
