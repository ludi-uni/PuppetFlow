import { describe, expect, it } from "vitest";
import { TimelineStore } from "./timeline-store.js";

describe("TimelineStore", () => {
  it("returns active events for currentMs", () => {
    const store = new TimelineStore();
    store.push({
      startMs: 0,
      endMs: 120,
      type: "phoneme",
      value: { phoneme: "A", strength: 1 },
    });

    expect(store.getActiveEvents(60)).toHaveLength(1);
    expect(store.getActiveEvents(150)).toHaveLength(0);
  });

  it("gc removes old events", () => {
    const store = new TimelineStore({ gcBufferMs: 100 });
    store.push({
      startMs: 0,
      endMs: 50,
      type: "phoneme",
      value: "A",
    });

    expect(store.getActiveEvents(200)).toHaveLength(0);
    expect(store.getAll()).toHaveLength(0);
  });

  it("supports overlapping events", () => {
    const store = new TimelineStore();
    store.pushMany([
      { startMs: 0, endMs: 200, type: "phoneme", value: "A" },
      { startMs: 100, endMs: 300, type: "emotion", value: "joy" },
    ]);

    expect(store.getActiveEvents(150)).toHaveLength(2);
  });

  it("trims oldest events when maxEvents is exceeded", () => {
    const store = new TimelineStore({ maxEvents: 2 });

    store.push({ startMs: 0, endMs: 100, type: "phoneme", value: "A" });
    store.push({ startMs: 0, endMs: 200, type: "phoneme", value: "B" });
    store.push({ startMs: 0, endMs: 300, type: "phoneme", value: "C" });

    expect(store.getAll()).toHaveLength(2);
    expect(store.getAll().map((event) => event.value)).toEqual(["B", "C"]);
  });
});
