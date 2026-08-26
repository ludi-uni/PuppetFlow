import type {
  PollingStateSource,
  SourceUpdateTarget,
  StateSource,
  StateSourceUpdate,
} from "@puppetflow/source-core";
import { isPollingStateSource } from "@puppetflow/source-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StateSourceScheduler } from "./source-scheduler.js";

const MAX_TIMER_DELAY_MS = 2_147_483_647;

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function update(payload: string): StateSourceUpdate {
  return { payload: { payload } };
}

function createPollingSource(
  id: string,
  poll: (signal: AbortSignal) => Promise<StateSourceUpdate | undefined>,
  applied: Array<{ id: string; update: StateSourceUpdate; target: SourceUpdateTarget }>,
  options: { intervalMs?: number; apply?: (update: StateSourceUpdate) => void } = {},
): PollingStateSource {
  return {
    id,
    pollIntervalMs: options.intervalMs ?? 10,
    initialize: async () => {},
    update: async () => {},
    dispose: async () => {},
    poll,
    apply(sourceUpdate, target) {
      options.apply?.(sourceUpdate);
      applied.push({ id, update: sourceUpdate, target });
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("StateSourceScheduler", () => {
  it("recognizes only complete polling capabilities with valid intervals", () => {
    const applied: Array<{
      id: string;
      update: StateSourceUpdate;
      target: SourceUpdateTarget;
    }> = [];
    const polling = createPollingSource("polling", async () => undefined, applied);

    expect(isPollingStateSource(polling)).toBe(true);
    expect(isPollingStateSource({ ...polling, pollIntervalMs: Number.NaN })).toBe(
      false,
    );
    expect(isPollingStateSource({ ...polling, pollIntervalMs: -1 })).toBe(false);
    expect(isPollingStateSource({ ...polling, poll: undefined })).toBe(false);
    expect(isPollingStateSource({ ...polling, apply: undefined })).toBe(false);
  });

  it("keeps only the newest completed update before a drain", async () => {
    vi.useFakeTimers();
    const applied: Array<{
      id: string;
      update: StateSourceUpdate;
      target: SourceUpdateTarget;
    }> = [];
    const source = createPollingSource(
      "source",
      vi
        .fn<() => Promise<StateSourceUpdate | undefined>>()
        .mockResolvedValueOnce(update("first"))
        .mockResolvedValueOnce(update("second"))
        .mockResolvedValue(undefined),
      applied,
    );
    const scheduler = new StateSourceScheduler();
    const target = {} as SourceUpdateTarget;

    scheduler.start([source]);
    await vi.advanceTimersByTimeAsync(10);
    scheduler.drain(target);

    expect(applied).toEqual([{ id: "source", update: update("second"), target }]);
    await scheduler.stop();
  });

  it("does not start another poll while a source poll is still pending", async () => {
    vi.useFakeTimers();
    const applied: Array<{
      id: string;
      update: StateSourceUpdate;
      target: SourceUpdateTarget;
    }> = [];
    const firstPoll = deferred<StateSourceUpdate | undefined>();
    let pollCalls = 0;
    const source = createPollingSource(
      "source",
      async () => {
        pollCalls += 1;
        return pollCalls === 1 ? firstPoll.promise : undefined;
      },
      applied,
    );
    const scheduler = new StateSourceScheduler();

    scheduler.start([source]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(pollCalls).toBe(1);

    firstPoll.resolve(update("released"));
    await vi.advanceTimersByTimeAsync(10);
    expect(pollCalls).toBe(2);
    await scheduler.stop();
  });

  it("waits for the configured interval after an empty poll", async () => {
    vi.useFakeTimers();
    const applied: Array<{
      id: string;
      update: StateSourceUpdate;
      target: SourceUpdateTarget;
    }> = [];
    let pollCalls = 0;
    const source = createPollingSource(
      "event-buffer",
      async () => {
        pollCalls += 1;
        return undefined;
      },
      applied,
      { intervalMs: 16 },
    );
    const scheduler = new StateSourceScheduler();

    scheduler.start([source]);
    expect(pollCalls).toBe(1);
    await vi.advanceTimersByTimeAsync(15);
    expect(pollCalls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(pollCalls).toBe(2);
    await scheduler.stop();
  });

  it("does not let a long polling interval clamp to a one-millisecond loop", async () => {
    vi.useFakeTimers();
    const applied: Array<{
      id: string;
      update: StateSourceUpdate;
      target: SourceUpdateTarget;
    }> = [];
    let pollCalls = 0;
    const source = createPollingSource(
      "long-interval",
      async () => {
        pollCalls += 1;
        return undefined;
      },
      applied,
      { intervalMs: MAX_TIMER_DELAY_MS + 1 },
    );
    const scheduler = new StateSourceScheduler();
    const nativeSetTimeout = globalThis.setTimeout;
    const setTimeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback: () => void, delay?: number) =>
        nativeSetTimeout(
          callback,
          delay !== undefined && delay > MAX_TIMER_DELAY_MS ? 1 : delay,
        )) as typeof setTimeout);

    try {
      scheduler.start([source]);
      await vi.advanceTimersByTimeAsync(1);

      expect(pollCalls).toBe(1);
      await scheduler.stop();
    } finally {
      await scheduler.stop();
      setTimeoutSpy.mockRestore();
    }
  });

  it("aborts a pending poll and ignores its late result after stop", async () => {
    const applied: Array<{
      id: string;
      update: StateSourceUpdate;
      target: SourceUpdateTarget;
    }> = [];
    const pending = deferred<StateSourceUpdate | undefined>();
    let signal: AbortSignal | undefined;
    const source = createPollingSource(
      "source",
      async (pollSignal) => {
        signal = pollSignal;
        return pending.promise;
      },
      applied,
    );
    const scheduler = new StateSourceScheduler();
    const target = {} as SourceUpdateTarget;

    scheduler.start([source]);
    const stopped = scheduler.stop();
    expect(signal?.aborted).toBe(true);

    pending.resolve(update("late"));
    await stopped;
    scheduler.drain(target);

    expect(applied).toEqual([]);
  });

  it("drains each source's update synchronously in attachment order", async () => {
    const applied: Array<{
      id: string;
      update: StateSourceUpdate;
      target: SourceUpdateTarget;
    }> = [];
    const first = createPollingSource("first", async () => update("one"), applied);
    const second = createPollingSource("second", async () => update("two"), applied);
    const scheduler = new StateSourceScheduler();
    const target = {} as SourceUpdateTarget;

    scheduler.start([first, second]);
    await Promise.resolve();
    scheduler.drain(target);

    expect(applied).toEqual([
      { id: "first", update: update("one"), target },
      { id: "second", update: update("two"), target },
    ]);
    await scheduler.stop();
  });

  it("drains only the selected source and clears its slot", async () => {
    const applied: Array<{
      id: string;
      update: StateSourceUpdate;
      target: SourceUpdateTarget;
    }> = [];
    const first = createPollingSource("first", async () => update("one"), applied);
    const second = createPollingSource("second", async () => update("two"), applied);
    const scheduler = new StateSourceScheduler();
    const target = {} as SourceUpdateTarget;

    scheduler.start([first, second]);
    await Promise.resolve();
    expect(scheduler.drainSource(second, target)).toBe(true);
    expect(scheduler.drainSource(second, target)).toBe(true);

    expect(applied).toEqual([{ id: "second", update: update("two"), target }]);

    scheduler.drain(target);
    expect(applied).toEqual([
      { id: "second", update: update("two"), target },
      { id: "first", update: update("one"), target },
    ]);
    await scheduler.stop();
  });

  it("drains only updates captured at the tick boundary", async () => {
    vi.useFakeTimers();
    const applied: Array<{
      id: string;
      update: StateSourceUpdate;
      target: SourceUpdateTarget;
    }> = [];
    const late = deferred<StateSourceUpdate | undefined>();
    let pollCalls = 0;
    const source = createPollingSource(
      "source",
      () => {
        pollCalls += 1;
        return pollCalls === 1 ? Promise.resolve(update("captured")) : late.promise;
      },
      applied,
    );
    const scheduler = new StateSourceScheduler();
    const target = {} as SourceUpdateTarget;

    scheduler.start([source]);
    try {
      await vi.advanceTimersByTimeAsync(10);
      expect(pollCalls).toBe(2);

      scheduler.capture();
      late.resolve(update("late"));
      await vi.advanceTimersByTimeAsync(0);

      expect(scheduler.drainSource(source, target)).toBe(true);
      expect(applied).toEqual([{ id: "source", update: update("captured"), target }]);
      expect(scheduler.drainSource(source, target)).toBe(true);
      expect(applied).toEqual([{ id: "source", update: update("captured"), target }]);

      scheduler.capture();
      expect(scheduler.drainSource(source, target)).toBe(true);
      expect(applied).toEqual([
        { id: "source", update: update("captured"), target },
        { id: "source", update: update("late"), target },
      ]);
    } finally {
      late.resolve(undefined);
      await scheduler.stop();
    }
  });

  it("returns false when a source is not scheduler-managed", () => {
    const source: StateSource = {
      id: "legacy",
      initialize: async () => {},
      update: async () => {},
      dispose: async () => {},
    };
    const scheduler = new StateSourceScheduler();

    expect(scheduler.drainSource(source, {} as SourceUpdateTarget)).toBe(false);
  });

  it("deduplicates repeated polling source instances", async () => {
    const applied: Array<{
      id: string;
      update: StateSourceUpdate;
      target: SourceUpdateTarget;
    }> = [];
    const pending = deferred<StateSourceUpdate | undefined>();
    let pollCalls = 0;
    const source = createPollingSource(
      "duplicate",
      () => {
        pollCalls += 1;
        return pending.promise;
      },
      applied,
    );
    const scheduler = new StateSourceScheduler();
    const target = {} as SourceUpdateTarget;

    try {
      scheduler.start([source, source]);
      expect(pollCalls).toBe(1);

      pending.resolve(update("only"));
      await Promise.resolve();
      scheduler.drain(target);

      expect(applied).toEqual([{ id: "duplicate", update: update("only"), target }]);
    } finally {
      pending.resolve(undefined);
      await scheduler.stop();
    }
  });

  it("keeps distinct polling source objects independent when their ids match", async () => {
    const applied: Array<{
      id: string;
      update: StateSourceUpdate;
      target: SourceUpdateTarget;
    }> = [];
    const first = createPollingSource("same-id", async () => update("one"), applied);
    const second = createPollingSource("same-id", async () => update("two"), applied);
    const scheduler = new StateSourceScheduler();
    const target = {} as SourceUpdateTarget;

    scheduler.start([first, second]);
    await Promise.resolve();
    scheduler.drain(target);

    expect(applied).toEqual([
      { id: "same-id", update: update("one"), target },
      { id: "same-id", update: update("two"), target },
    ]);
    await scheduler.stop();
  });

  it("isolates poll and apply errors so other sources continue", async () => {
    vi.useFakeTimers();
    const applied: Array<{
      id: string;
      update: StateSourceUpdate;
      target: SourceUpdateTarget;
    }> = [];
    const errors: Array<{ source: string; error: unknown }> = [];
    let failingPollAttempts = 0;
    const failingPoll = createPollingSource(
      "poll-error",
      async () => {
        failingPollAttempts += 1;
        if (failingPollAttempts === 1) {
          throw new Error("poll failed");
        }
        return update("recovered");
      },
      applied,
    );
    const failingApply = createPollingSource(
      "apply-error",
      (() => {
        let attempts = 0;
        return async () => {
          attempts += 1;
          return attempts === 1 ? update("bad") : undefined;
        };
      })(),
      applied,
      {
        apply: () => {
          throw new Error("apply failed");
        },
      },
    );
    const healthy = createPollingSource("healthy", async () => update("good"), applied);
    const scheduler = new StateSourceScheduler({
      onError(source, error) {
        errors.push({ source: source.id, error });
      },
    });
    const target = {} as SourceUpdateTarget;

    scheduler.start([failingPoll, failingApply, healthy]);
    await Promise.resolve();
    scheduler.drain(target);
    await vi.advanceTimersByTimeAsync(10);
    scheduler.drain(target);

    expect(applied).toEqual([
      { id: "healthy", update: update("good"), target },
      { id: "poll-error", update: update("recovered"), target },
      { id: "healthy", update: update("good"), target },
    ]);
    expect(errors.map(({ source }) => source)).toEqual(["poll-error", "apply-error"]);
    await scheduler.stop();
  });
});
