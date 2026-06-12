import type { TimelineEvent } from "./timeline.js";

export class TimelineStore {
  private readonly events: TimelineEvent[] = [];
  private readonly gcBufferMs: number;

  constructor(options: { gcBufferMs?: number } = {}) {
    this.gcBufferMs = options.gcBufferMs ?? 5000;
  }

  push(event: TimelineEvent): void {
    this.events.push({ ...event });
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
