import type { Adapter, MotionFrameAdapter } from "@puppetflow/adapter-core";
import type {
  BehaviorPlugin,
  MotionFrame,
  MotionState,
  PluginInputStores,
} from "@puppetflow/core";
import { SmoothingModifier } from "@puppetflow/modifier";
import { loadPreset } from "@puppetflow/preset";
import { describe, expect, it, vi } from "vitest";
import { GazePlugin } from "@puppetflow/plugin-gaze";
import { StatefulStore } from "@puppetflow/stateful-core";
import type {
  MotionSource,
  PollingStateSource,
  StateSource,
  StateSourceUpdate,
} from "@puppetflow/source-core";
import type { MotionFrameGraphDocument } from "@puppetflow/motion-graph";
import type { MotionFrameInput, MotionLayerPolicy } from "@puppetflow/motion-pipeline";
import { PuppetFlowRuntime } from "./runtime.js";

class TestPlugin implements BehaviorPlugin {
  readonly id = "test";

  constructor(private readonly output: Partial<MotionState>) {}

  process(_input: PluginInputStores, _motion: MotionState): Partial<MotionState> {
    return this.output;
  }
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createTestAdapter(update: Adapter["update"]): Adapter {
  return {
    id: "test-adapter",
    initialize: vi.fn(async () => {}),
    update,
    dispose: vi.fn(async () => {}),
  };
}

function createMotionSource(id: string, timestamp: number): MotionSource {
  return {
    id,
    start: vi.fn(async (emit) =>
      emit({ timestamp, parameters: { source: timestamp } }),
    ),
    stop: vi.fn(async () => {}),
  };
}

const motionFrameGraph: MotionFrameGraphDocument = {
  version: 1,
  initialState: "idle",
  states: [
    {
      id: "idle",
      sources: { idle: { enabled: true }, tracker: { enabled: false } },
    },
    {
      id: "tracking",
      sources: {
        idle: { enabled: false },
        tracker: { enabled: true, priority: 200 },
      },
    },
  ],
  transitions: [
    {
      from: "idle",
      to: "tracking",
      when: { type: "signal", key: "tracking", operator: "equals", value: true },
    },
  ],
};

describe("PuppetFlowRuntime", () => {
  it("lets an adapter dispose hook await stop without blocking cleanup or a later restart", async () => {
    const escapeNestedStop = createDeferred<void>();
    const releaseCleanup = createDeferred<void>();
    let disposeCalls = 0;
    let nestedStopCompleted = false;
    let nestedStop: Promise<void> | undefined;
    const runtimeRef: { current?: PuppetFlowRuntime } = {};
    const adapter: Adapter = {
      id: "await-stop-dispose-adapter",
      initialize: async () => {},
      update: async () => {},
      dispose: async () => {
        disposeCalls += 1;
        nestedStop = runtimeRef.current!.stop();
        await Promise.race([nestedStop, escapeNestedStop.promise]);
        nestedStopCompleted = true;
        await releaseCleanup.promise;
      },
    };
    const runtime = new PuppetFlowRuntime().attachAdapter(adapter);
    runtimeRef.current = runtime;
    await runtime.start();
    const outerStop = runtime.stop();
    let restart: Promise<void> | undefined;

    try {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 30);
      });
      expect(nestedStopCompleted).toBe(true);

      restart = runtime.start();
      let restartCompleted = false;
      void restart.then(() => {
        restartCompleted = true;
      });
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 30);
      });
      expect(restartCompleted).toBe(false);

      releaseCleanup.resolve();
      await Promise.all([outerStop, restart]);

      expect(disposeCalls).toBe(1);
      expect(runtime.isRunning()).toBe(true);
    } finally {
      escapeNestedStop.resolve();
      releaseCleanup.resolve();
      await Promise.allSettled([outerStop, restart ?? runtime.stop()]);
      await runtime.stop();
    }
  });

  it("lets a StateSource dispose hook await stop without reentering cleanup", async () => {
    const escapeNestedStop = createDeferred<void>();
    let disposeCalls = 0;
    let nestedStopCompleted = false;
    const runtimeRef: { current?: PuppetFlowRuntime } = {};
    const source: StateSource = {
      id: "await-stop-dispose-source",
      initialize: async () => {},
      update: async () => {},
      dispose: async () => {
        disposeCalls += 1;
        await Promise.race([runtimeRef.current!.stop(), escapeNestedStop.promise]);
        nestedStopCompleted = true;
      },
    };
    const runtime = new PuppetFlowRuntime().attachSource(source);
    runtimeRef.current = runtime;
    await runtime.start();
    const outerStop = runtime.stop();

    try {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 30);
      });
      expect(nestedStopCompleted).toBe(true);
      await outerStop;
      expect(disposeCalls).toBe(1);
    } finally {
      escapeNestedStop.resolve();
      await Promise.allSettled([outerStop]);
      await runtime.stop();
    }
  });

  it("lets a MotionSource stop hook await stop without reentering cleanup", async () => {
    const escapeNestedStop = createDeferred<void>();
    let stopCalls = 0;
    let nestedStopCompleted = false;
    const runtimeRef: { current?: PuppetFlowRuntime } = {};
    const source: MotionSource = {
      id: "await-stop-motion-source",
      start: async () => {},
      stop: async () => {
        stopCalls += 1;
        await Promise.race([runtimeRef.current!.stop(), escapeNestedStop.promise]);
        nestedStopCompleted = true;
      },
    };
    const runtime = new PuppetFlowRuntime().attachMotionSource(source);
    runtimeRef.current = runtime;
    await runtime.start();
    const outerStop = runtime.stop();

    try {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 30);
      });
      expect(nestedStopCompleted).toBe(true);
      await outerStop;
      expect(stopCalls).toBe(1);
    } finally {
      escapeNestedStop.resolve();
      await Promise.allSettled([outerStop]);
      await runtime.stop();
    }
  });

  it("releases an initialization hook that awaits stop after bounded quiescence", async () => {
    const escapeHook = createDeferred<void>();
    const hookEntered = createDeferred<void>();
    let hookCompleted = false;
    let requestedStop: Promise<void> | undefined;
    const runtimeRef: { current?: PuppetFlowRuntime } = {};
    const source: StateSource = {
      id: "await-stop-initialize",
      initialize: async () => {
        hookEntered.resolve();
        requestedStop = runtimeRef.current!.stop();
        await Promise.race([requestedStop, escapeHook.promise]);
        hookCompleted = true;
      },
      update: async () => {},
      dispose: async () => {},
    };
    const runtime = new PuppetFlowRuntime().attachSource(source);
    runtimeRef.current = runtime;
    const start = runtime.start();

    try {
      await hookEntered.promise;
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 3_500);
      });

      expect(hookCompleted).toBe(true);
      await Promise.all([start, requestedStop]);
      expect(runtime.isRunning()).toBe(false);
    } finally {
      escapeHook.resolve();
      await Promise.allSettled([start, requestedStop ?? runtime.stop()]);
      await runtime.stop();
    }
  }, 10_000);

  it("keeps the runtime stopped when a later stop cancels a queued start", async () => {
    vi.useFakeTimers();
    const initialization = createDeferred<void>();
    let initializeCalls = 0;
    const source: StateSource = {
      id: "queued-start-source",
      initialize: async () => {
        initializeCalls += 1;
        await initialization.promise;
      },
      update: async () => {},
      dispose: async () => {},
    };
    const runtime = new PuppetFlowRuntime().attachSource(source);
    const initialStart = runtime.start();

    try {
      await Promise.resolve();
      expect(initializeCalls).toBe(1);

      const firstStop = runtime.stop();
      const queuedStart = runtime.start();
      const finalStop = runtime.stop();
      initialization.resolve();

      await Promise.all([initialStart, firstStop, queuedStart, finalStop]);

      expect(runtime.isRunning()).toBe(false);
      expect(
        (runtime as unknown as { intervalId: ReturnType<typeof setInterval> | null })
          .intervalId,
      ).toBeNull();
      expect(initializeCalls).toBe(1);
    } finally {
      initialization.resolve();
      await Promise.allSettled([initialStart, runtime.stop()]);
      await runtime.stop();
      vi.useRealTimers();
    }
  });

  it("coalesces starts queued behind a normal stop until the shared restart completes", async () => {
    vi.useFakeTimers();
    const firstInitialization = createDeferred<void>();
    const secondInitialization = createDeferred<void>();
    const secondStartEntered = createDeferred<void>();
    let initializeCalls = 0;
    const source: StateSource = {
      id: "coalesced-normal-start",
      initialize: async () => {
        initializeCalls += 1;
        if (initializeCalls === 1) {
          await firstInitialization.promise;
          return;
        }
        secondStartEntered.resolve();
        await secondInitialization.promise;
      },
      update: async () => {},
      dispose: async () => {},
    };
    const runtime = new PuppetFlowRuntime().attachSource(source);
    const initialStart = runtime.start();

    try {
      await Promise.resolve();
      const stop = runtime.stop();
      const firstQueuedStart = runtime.start();
      const secondQueuedStart = runtime.start();
      expect(secondQueuedStart).toBe(firstQueuedStart);

      firstInitialization.resolve();
      await Promise.all([initialStart, stop]);
      await secondStartEntered.promise;

      let queuedStartFinished = false;
      void firstQueuedStart.then(() => {
        queuedStartFinished = true;
      });
      await Promise.resolve();
      expect(queuedStartFinished).toBe(false);

      secondInitialization.resolve();
      await Promise.all([firstQueuedStart, secondQueuedStart]);

      expect(runtime.isRunning()).toBe(true);
      expect(initializeCalls).toBe(2);
    } finally {
      firstInitialization.resolve();
      secondInitialization.resolve();
      await Promise.allSettled([initialStart, runtime.stop()]);
      await runtime.stop();
      vi.useRealTimers();
    }
  });

  it("rolls back a standalone initial-tick listener failure before a later start", async () => {
    const failure = new Error("standalone initial listener failed");
    let adapterInitializeCalls = 0;
    let adapterDisposeCalls = 0;
    let sourceInitializeCalls = 0;
    let sourceDisposeCalls = 0;
    let motionStartCalls = 0;
    let motionStopCalls = 0;
    let listenerCalls = 0;
    const adapter: Adapter = {
      id: "standalone-failure-adapter",
      initialize: async () => {
        adapterInitializeCalls += 1;
      },
      update: async () => {},
      dispose: async () => {
        adapterDisposeCalls += 1;
      },
    };
    const source: StateSource = {
      id: "standalone-failure-source",
      initialize: async () => {
        sourceInitializeCalls += 1;
      },
      update: async () => {},
      dispose: async () => {
        sourceDisposeCalls += 1;
      },
    };
    const motion: MotionSource = {
      id: "standalone-failure-motion",
      start: async () => {
        motionStartCalls += 1;
      },
      stop: async () => {
        motionStopCalls += 1;
      },
    };
    const runtime = new PuppetFlowRuntime()
      .attachAdapter(adapter)
      .attachSource(source)
      .attachMotionSource(motion);
    runtime.onMotionUpdate(() => {
      listenerCalls += 1;
      if (listenerCalls === 2) {
        throw failure;
      }
    });

    try {
      await expect(runtime.start()).rejects.toBe(failure);

      expect(runtime.isRunning()).toBe(false);
      expect(adapterDisposeCalls).toBe(1);
      expect(sourceDisposeCalls).toBe(1);
      expect(motionStopCalls).toBe(1);

      await runtime.start();

      expect(runtime.isRunning()).toBe(true);
      expect(adapterInitializeCalls).toBe(2);
      expect(sourceInitializeCalls).toBe(2);
      expect(motionStartCalls).toBe(2);
    } finally {
      await runtime.stop().catch(() => {});
    }
  });

  it("stops initializing later adapters after cancellation", async () => {
    let laterInitializeCalls = 0;
    let requestedStop: Promise<void> | undefined;
    const runtimeRef: { current?: PuppetFlowRuntime } = {};
    const first: Adapter = {
      id: "cancelling-first-adapter",
      initialize: async () => {
        requestedStop = runtimeRef.current!.stop();
      },
      update: async () => {},
      dispose: async () => {},
    };
    const later: Adapter = {
      id: "later-adapter",
      initialize: async () => {
        laterInitializeCalls += 1;
      },
      update: async () => {},
      dispose: async () => {},
    };
    const runtime = new PuppetFlowRuntime().attachAdapter(first).attachAdapter(later);
    runtimeRef.current = runtime;

    try {
      await runtime.start();
      await requestedStop;

      expect(laterInitializeCalls).toBe(0);
      expect(runtime.isRunning()).toBe(false);
    } finally {
      await runtime.stop();
    }
  });

  it("stops initializing later sources after cancellation", async () => {
    let laterInitializeCalls = 0;
    let laterDisposeCalls = 0;
    let requestedStop: Promise<void> | undefined;
    const runtimeRef: { current?: PuppetFlowRuntime } = {};
    const first: StateSource = {
      id: "cancelling-first-source",
      initialize: async () => {
        requestedStop = runtimeRef.current!.stop();
      },
      update: async () => {},
      dispose: async () => {},
    };
    const later: StateSource = {
      id: "later-source",
      initialize: async () => {
        laterInitializeCalls += 1;
      },
      update: async () => {},
      dispose: async () => {
        laterDisposeCalls += 1;
      },
    };
    const runtime = new PuppetFlowRuntime().attachSource(first).attachSource(later);
    runtimeRef.current = runtime;

    try {
      await runtime.start();
      await requestedStop;

      expect(laterInitializeCalls).toBe(0);
      expect(laterDisposeCalls).toBe(0);
      expect(runtime.isRunning()).toBe(false);
    } finally {
      await runtime.stop();
    }
  });

  it("waits for pending source initialization before disposing after stop", async () => {
    vi.useFakeTimers();
    const initialization = createDeferred<void>();
    let initializeCalls = 0;
    let disposeCalls = 0;
    const source: StateSource = {
      id: "initializing-source",
      initialize: async () => {
        initializeCalls += 1;
        await initialization.promise;
      },
      update: async () => {},
      dispose: async () => {
        disposeCalls += 1;
      },
    };
    const runtime = new PuppetFlowRuntime().attachSource(source);
    const start = runtime.start();
    let stop: Promise<void> | undefined;

    try {
      await Promise.resolve();
      expect(initializeCalls).toBe(1);

      stop = runtime.stop();
      await Promise.resolve();
      expect(disposeCalls).toBe(0);

      initialization.resolve();
      await Promise.all([start, stop]);

      expect(runtime.isRunning()).toBe(false);
      expect(disposeCalls).toBe(1);
      expect(
        (runtime as unknown as { intervalId: ReturnType<typeof setInterval> | null })
          .intervalId,
      ).toBeNull();
    } finally {
      initialization.resolve();
      await Promise.allSettled([start, stop ?? runtime.stop()]);
      await runtime.stop();
      vi.useRealTimers();
    }
  });

  it("waits for a pending motion-source start before stopping it", async () => {
    vi.useFakeTimers();
    const motionStart = createDeferred<void>();
    const startEntered = createDeferred<void>();
    let startCalls = 0;
    let stopCalls = 0;
    let laterStartCalls = 0;
    let laterStopCalls = 0;
    const source: MotionSource = {
      id: "starting-motion-source",
      start: async () => {
        startCalls += 1;
        startEntered.resolve();
        await motionStart.promise;
      },
      stop: async () => {
        stopCalls += 1;
      },
    };
    const later: MotionSource = {
      id: "later-motion-source",
      start: async () => {
        laterStartCalls += 1;
      },
      stop: async () => {
        laterStopCalls += 1;
      },
    };
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(source)
      .attachMotionSource(later);
    const start = runtime.start();
    let stop: Promise<void> | undefined;

    try {
      await startEntered.promise;
      expect(startCalls).toBe(1);

      stop = runtime.stop();
      let stopFinished = false;
      void stop.then(() => {
        stopFinished = true;
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(stopCalls).toBe(0);
      expect(stopFinished).toBe(false);

      motionStart.resolve();
      await Promise.all([start, stop]);

      expect(runtime.isRunning()).toBe(false);
      expect(stopCalls).toBe(1);
      expect(laterStartCalls).toBe(0);
      expect(laterStopCalls).toBe(0);
      expect(
        (runtime as unknown as { intervalId: ReturnType<typeof setInterval> | null })
          .intervalId,
      ).toBeNull();
    } finally {
      motionStart.resolve();
      await Promise.allSettled([start, stop ?? runtime.stop()]);
      await runtime.stop();
      vi.useRealTimers();
    }
  });

  it("aborts polling immediately while a motion source is still starting", async () => {
    vi.useFakeTimers();
    const poll = createDeferred<StateSourceUpdate | undefined>();
    const motionStart = createDeferred<void>();
    const startEntered = createDeferred<void>();
    let signal: AbortSignal | undefined;
    const polling: PollingStateSource = {
      id: "polling-during-motion-start",
      initialize: async () => {},
      update: async () => {},
      dispose: async () => {},
      pollIntervalMs: 100_000,
      poll: async (nextSignal) => {
        signal = nextSignal;
        return poll.promise;
      },
      apply: () => {},
    };
    const motion: MotionSource = {
      id: "blocked-motion-start",
      start: async () => {
        startEntered.resolve();
        await motionStart.promise;
      },
      stop: async () => {},
    };
    const runtime = new PuppetFlowRuntime()
      .attachSource(polling)
      .attachMotionSource(motion);
    const start = runtime.start();
    let stop: Promise<void> | undefined;

    try {
      await startEntered.promise;
      expect(signal).toBeDefined();

      stop = runtime.stop();
      expect(signal?.aborted).toBe(true);

      poll.resolve(undefined);
      motionStart.resolve();
      await Promise.all([start, stop]);
    } finally {
      poll.resolve(undefined);
      motionStart.resolve();
      await Promise.allSettled([start, stop ?? runtime.stop()]);
      await runtime.stop();
      vi.useRealTimers();
    }
  });

  it("stops a MotionSource after a partially acquiring start rejects", async () => {
    const failure = new Error("motion acquisition failed");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    let stopCalls = 0;
    const source: MotionSource = {
      id: "partially-acquired-motion-source",
      start: async () => {
        throw failure;
      },
      stop: async () => {
        stopCalls += 1;
      },
    };
    const runtime = new PuppetFlowRuntime().attachMotionSource(source);

    try {
      await runtime.start();
      await runtime.stop();

      expect(stopCalls).toBe(1);
    } finally {
      await runtime.stop();
      error.mockRestore();
    }
  });

  it("restarts when rollback cleanup requests start after a standalone failure", async () => {
    const failure = new Error("rollback listener failed");
    let initializeCalls = 0;
    let disposeCalls = 0;
    let listenerCalls = 0;
    let reentrantStart: Promise<void> | undefined;
    const runtimeRef: { current?: PuppetFlowRuntime } = {};
    const adapter: Adapter = {
      id: "rollback-reentrant-adapter",
      initialize: async () => {
        initializeCalls += 1;
      },
      update: async () => {},
      dispose: async () => {
        disposeCalls += 1;
        if (disposeCalls === 1) {
          reentrantStart = runtimeRef.current!.start();
        }
      },
    };
    const runtime = new PuppetFlowRuntime().attachAdapter(adapter);
    runtimeRef.current = runtime;
    runtime.onMotionUpdate(() => {
      listenerCalls += 1;
      if (listenerCalls === 2) {
        throw failure;
      }
    });

    try {
      await expect(runtime.start()).rejects.toBe(failure);
      expect(reentrantStart).toBeDefined();
      await expect(reentrantStart).resolves.toBeUndefined();

      expect(runtime.isRunning()).toBe(true);
      expect(initializeCalls).toBe(2);
      expect(disposeCalls).toBe(1);
    } finally {
      await runtime.stop();
    }
  });

  it("cleans up resources before rethrowing an initial-tick listener failure", async () => {
    const failure = new Error("initial listener failed");
    let adapterDisposeCalls = 0;
    let sourceDisposeCalls = 0;
    let motionStopCalls = 0;
    let requestedStop: Promise<void> | undefined;
    let listenerCalls = 0;
    const adapter: Adapter = {
      id: "failing-listener-adapter",
      initialize: async () => {},
      update: async () => {},
      dispose: async () => {
        adapterDisposeCalls += 1;
      },
    };
    const source: StateSource = {
      id: "failing-listener-source",
      initialize: async () => {},
      update: async () => {},
      dispose: async () => {
        sourceDisposeCalls += 1;
      },
    };
    const motion: MotionSource = {
      id: "failing-listener-motion",
      start: async () => {},
      stop: async () => {
        motionStopCalls += 1;
      },
    };
    const runtime = new PuppetFlowRuntime()
      .attachAdapter(adapter)
      .attachSource(source)
      .attachMotionSource(motion);
    runtime.onMotionUpdate(() => {
      listenerCalls += 1;
      if (listenerCalls === 2) {
        requestedStop = runtime.stop();
        throw failure;
      }
    });

    const start = runtime.start();
    try {
      await expect(start).rejects.toBe(failure);
      await expect(requestedStop).rejects.toBe(failure);

      expect(adapterDisposeCalls).toBe(1);
      expect(sourceDisposeCalls).toBe(1);
      expect(motionStopCalls).toBe(1);
    } finally {
      await runtime.stop().catch(() => {});
    }
  });

  it("waits to restart until a timed-out tick exits and deferred cleanup completes", async () => {
    const releaseBlockedUpdate = createDeferred<void>();
    let blockUpdates = false;
    let blocked = false;
    let initializeCalls = 0;
    let disposeCalls = 0;
    let updateCalls = 0;
    const adapter: Adapter = {
      id: "timeout-gate-adapter",
      initialize: async () => {
        initializeCalls += 1;
      },
      update: async () => {
        updateCalls += 1;
        if (blockUpdates) {
          blocked = true;
          await releaseBlockedUpdate.promise;
        }
      },
      dispose: async () => {
        disposeCalls += 1;
      },
    };
    const runtime = new PuppetFlowRuntime().attachAdapter(adapter);
    await runtime.start();
    blockUpdates = true;
    runtime.state.set("block", true);
    await vi.waitFor(() => expect(blocked).toBe(true));
    const stop = runtime.stop();
    let restart: Promise<void> | undefined;
    let secondRestart: Promise<void> | undefined;

    try {
      await stop;
      expect(disposeCalls).toBe(0);

      restart = runtime.start();
      secondRestart = runtime.start();
      expect(secondRestart).toBe(restart);
      let restartFinished = false;
      void restart.then(() => {
        restartFinished = true;
      });
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 25);
      });

      expect(restartFinished).toBe(false);
      expect(initializeCalls).toBe(1);
      expect(updateCalls).toBe(2);

      releaseBlockedUpdate.resolve();
      await Promise.all([restart, secondRestart]);

      expect(disposeCalls).toBe(1);
      expect(initializeCalls).toBe(2);
    } finally {
      releaseBlockedUpdate.resolve();
      await Promise.allSettled([
        stop,
        restart ?? runtime.stop(),
        secondRestart ?? runtime.stop(),
      ]);
      await runtime.stop();
    }
  });

  it("keeps stopped when a later stop cancels a start queued behind a timeout gate", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const runtime = new PuppetFlowRuntime();

    try {
      await runtime.start();
      (runtime as unknown as { tickInProgress: boolean }).tickInProgress = true;

      const firstStop = runtime.stop();
      await firstStop;
      const queuedStart = runtime.start();
      const finalStop = runtime.stop();
      (runtime as unknown as { tickInProgress: boolean }).tickInProgress = false;

      await Promise.all([queuedStart, finalStop]);

      expect(runtime.isRunning()).toBe(false);
      expect(
        (runtime as unknown as { intervalId: ReturnType<typeof setInterval> | null })
          .intervalId,
      ).toBeNull();
    } finally {
      (runtime as unknown as { tickInProgress: boolean }).tickInProgress = false;
      await runtime.stop();
      warn.mockRestore();
    }
  });

  it("shares one startup operation across concurrent starts", async () => {
    vi.useFakeTimers();
    const initialization = createDeferred<void>();
    let initializeCalls = 0;
    const source: StateSource = {
      id: "single-flight-source",
      initialize: async () => {
        initializeCalls += 1;
        await initialization.promise;
      },
      update: async () => {},
      dispose: async () => {},
    };
    const runtime = new PuppetFlowRuntime().attachSource(source);
    const firstStart = runtime.start();
    const secondStart = runtime.start();

    try {
      await Promise.resolve();
      expect(initializeCalls).toBe(1);

      initialization.resolve();
      await Promise.all([firstStart, secondStart]);

      expect(runtime.isRunning()).toBe(true);
      expect(
        (runtime as unknown as { intervalId: ReturnType<typeof setInterval> | null })
          .intervalId,
      ).not.toBeNull();
      expect(vi.getTimerCount()).toBe(1);
    } finally {
      initialization.resolve();
      await Promise.allSettled([firstStart, secondStart]);
      await runtime.stop();
      vi.useRealTimers();
    }
  });

  it("initializes and disposes duplicate StateSource objects once by identity", async () => {
    vi.useFakeTimers();
    let sharedInitializeCalls = 0;
    let sharedDisposeCalls = 0;
    let distinctInitializeCalls = 0;
    let distinctDisposeCalls = 0;
    const shared: StateSource = {
      id: "duplicate-id",
      initialize: async () => {
        sharedInitializeCalls += 1;
      },
      update: async () => {},
      dispose: async () => {
        sharedDisposeCalls += 1;
      },
    };
    const distinctSameId: StateSource = {
      id: "duplicate-id",
      initialize: async () => {
        distinctInitializeCalls += 1;
      },
      update: async () => {},
      dispose: async () => {
        distinctDisposeCalls += 1;
      },
    };
    const runtime = new PuppetFlowRuntime()
      .attachSource(shared)
      .attachSource(shared)
      .attachSource(distinctSameId);

    try {
      await runtime.start();

      expect(sharedInitializeCalls).toBe(1);
      expect(distinctInitializeCalls).toBe(1);

      await runtime.stop();

      expect(sharedDisposeCalls).toBe(1);
      expect(distinctDisposeCalls).toBe(1);
    } finally {
      await runtime.stop();
      vi.useRealTimers();
    }
  });

  it("does not finish startup after an initial polling source requests stop", async () => {
    vi.useFakeTimers();
    const poll = createDeferred<StateSourceUpdate | undefined>();
    let disposeCalls = 0;
    let requestedStop: Promise<void> | undefined;
    const runtimeRef: { current?: PuppetFlowRuntime } = {};
    const source: PollingStateSource = {
      id: "stop-during-initial-poll",
      initialize: async () => {},
      update: async () => {},
      dispose: async () => {
        disposeCalls += 1;
      },
      pollIntervalMs: 100_000,
      poll: async () => {
        requestedStop = runtimeRef.current!.stop();
        return poll.promise;
      },
      apply: () => {},
    };
    const runtime = new PuppetFlowRuntime().attachSource(source);
    runtimeRef.current = runtime;

    try {
      await runtime.start();

      expect(requestedStop).toBeDefined();
      expect(runtime.isRunning()).toBe(false);
      expect(
        (runtime as unknown as { intervalId: ReturnType<typeof setInterval> | null })
          .intervalId,
      ).toBeNull();
      expect(disposeCalls).toBe(0);

      poll.resolve(undefined);
      await vi.advanceTimersByTimeAsync(0);
      await requestedStop;

      expect(disposeCalls).toBe(1);
      expect(
        (runtime as unknown as { intervalId: ReturnType<typeof setInterval> | null })
          .intervalId,
      ).toBeNull();
    } finally {
      poll.resolve(undefined);
      await requestedStop;
      vi.useRealTimers();
    }
  });

  it("does not delay the first behavior tick for a pending polling source", async () => {
    const poll = createDeferred<StateSourceUpdate | undefined>();
    let signal: AbortSignal | undefined;
    const observed: unknown[] = [];
    const source: PollingStateSource = {
      id: "delayed",
      initialize: async () => {},
      update: async () => {},
      dispose: async () => {},
      pollIntervalMs: 100_000,
      poll: async (nextSignal) => {
        signal = nextSignal;
        return poll.promise;
      },
      apply: () => {},
    };
    const runtime = new PuppetFlowRuntime()
      .use({
        id: "observer",
        process(input) {
          observed.push(input.state.get("pollingValue"));
          return {};
        },
      })
      .attachSource(source);

    await runtime.start();

    expect(observed).toEqual([undefined]);
    expect(signal).toBeDefined();

    const stop = runtime.stop();
    expect(signal?.aborted).toBe(true);
    poll.resolve(undefined);
    await stop;
  });

  it("applies a completed polling update to behavior once at a later tick boundary", async () => {
    vi.useFakeTimers();
    const firstPoll = createDeferred<StateSourceUpdate | undefined>();
    const secondPoll = createDeferred<StateSourceUpdate | undefined>();
    const observed: unknown[] = [];
    const applied: unknown[] = [];
    let legacyUpdateCalls = 0;
    let pollCalls = 0;
    const source: PollingStateSource = {
      id: "latest",
      initialize: async () => {},
      update: async () => {
        legacyUpdateCalls += 1;
      },
      dispose: async () => {},
      pollIntervalMs: 0,
      poll: async () => {
        pollCalls += 1;
        return pollCalls === 1 ? firstPoll.promise : secondPoll.promise;
      },
      apply: (update, target) => {
        applied.push(update.payload);
        target.state.set("pollingValue", update.payload);
      },
    };
    const runtime = new PuppetFlowRuntime()
      .use({
        id: "observer",
        process(input) {
          observed.push(input.state.get("pollingValue"));
          return {};
        },
      })
      .attachSource(source);

    try {
      await runtime.start();
      firstPoll.resolve({ payload: "older" });
      await vi.advanceTimersByTimeAsync(0);
      expect(pollCalls).toBe(2);

      secondPoll.resolve({ payload: "newest" });
      await Promise.resolve();
      runtime.state.set("forceTick", true);
      await Promise.resolve();

      expect(observed).toEqual([undefined, "newest"]);
      expect(applied).toEqual(["newest"]);
      expect(legacyUpdateCalls).toBe(0);
    } finally {
      await runtime.stop();
      vi.useRealTimers();
    }
  });

  it("drains completed polling sources in attachment order", async () => {
    const applyOrder: string[] = [];
    const createSource = (id: string): PollingStateSource => ({
      id,
      initialize: async () => {},
      update: async () => {},
      dispose: async () => {},
      pollIntervalMs: 100_000,
      poll: async () => ({ payload: id }),
      apply: (update, target) => {
        applyOrder.push(id);
        target.state.set(id, update.payload);
      },
    });
    const runtime = new PuppetFlowRuntime()
      .attachSource(createSource("first"))
      .attachSource(createSource("second"));

    await runtime.start();
    await Promise.resolve();
    runtime.state.set("forceTick", true);

    await vi.waitFor(() => expect(applyOrder).toEqual(["first", "second"]));
    expect(runtime.state.get("first")).toBe("first");
    expect(runtime.state.get("second")).toBe("second");

    await runtime.stop();
  });

  it("applies a legacy source before a later polling source in attachment order", async () => {
    vi.useFakeTimers();
    const poll = createDeferred<StateSourceUpdate | undefined>();
    const order: string[] = [];
    const observed: unknown[] = [];
    let legacyEnabled = false;
    let pollStarted = false;
    let pollingUpdateCalls = 0;
    const legacy: StateSource = {
      id: "legacy-first",
      initialize: async () => {},
      update: async (target) => {
        if (!legacyEnabled) {
          return;
        }
        order.push("legacy-first");
        target.state.set("sharedValue", "legacy");
      },
      dispose: async () => {},
    };
    const polling: PollingStateSource = {
      id: "polling-second",
      initialize: async () => {},
      update: async () => {
        pollingUpdateCalls += 1;
      },
      dispose: async () => {},
      pollIntervalMs: 100_000,
      poll: async () => {
        pollStarted = true;
        return poll.promise;
      },
      apply: (update, target) => {
        order.push("polling-second");
        target.state.set("sharedValue", update.payload);
      },
    };
    const runtime = new PuppetFlowRuntime()
      .use({
        id: "observer",
        process(input) {
          observed.push(input.state.get("sharedValue"));
          return {};
        },
      })
      .attachSource(legacy)
      .attachSource(polling);

    try {
      await runtime.start();
      expect(pollStarted).toBe(true);
      observed.length = 0;
      legacyEnabled = true;
      poll.resolve({ payload: "polling" });
      await Promise.resolve();
      runtime.state.set("forceTick", true);
      await Promise.resolve();
      await Promise.resolve();

      expect(order).toEqual(["legacy-first", "polling-second"]);
      expect(runtime.state.get("sharedValue")).toBe("polling");
      expect(observed).toEqual(["polling"]);
      expect(pollingUpdateCalls).toBe(0);
    } finally {
      await runtime.stop();
      vi.useRealTimers();
    }
  });

  it("applies a polling source before a later legacy source in attachment order", async () => {
    vi.useFakeTimers();
    const poll = createDeferred<StateSourceUpdate | undefined>();
    const order: string[] = [];
    const observed: unknown[] = [];
    let legacyEnabled = false;
    let pollStarted = false;
    let pollingUpdateCalls = 0;
    const polling: PollingStateSource = {
      id: "polling-first",
      initialize: async () => {},
      update: async () => {
        pollingUpdateCalls += 1;
      },
      dispose: async () => {},
      pollIntervalMs: 100_000,
      poll: async () => {
        pollStarted = true;
        return poll.promise;
      },
      apply: (update, target) => {
        order.push("polling-first");
        target.state.set("sharedValue", update.payload);
      },
    };
    const legacy: StateSource = {
      id: "legacy-second",
      initialize: async () => {},
      update: async (target) => {
        if (!legacyEnabled) {
          return;
        }
        order.push("legacy-second");
        target.state.set("sharedValue", "legacy");
      },
      dispose: async () => {},
    };
    const runtime = new PuppetFlowRuntime()
      .use({
        id: "observer",
        process(input) {
          observed.push(input.state.get("sharedValue"));
          return {};
        },
      })
      .attachSource(polling)
      .attachSource(legacy);

    try {
      await runtime.start();
      expect(pollStarted).toBe(true);
      observed.length = 0;
      legacyEnabled = true;
      poll.resolve({ payload: "polling" });
      await Promise.resolve();
      runtime.state.set("forceTick", true);
      await Promise.resolve();
      await Promise.resolve();

      expect(order).toEqual(["polling-first", "legacy-second"]);
      expect(runtime.state.get("sharedValue")).toBe("legacy");
      expect(observed).toEqual(["legacy"]);
      expect(pollingUpdateCalls).toBe(0);
    } finally {
      await runtime.stop();
      vi.useRealTimers();
    }
  });

  it("defers a polling result that arrives during an earlier legacy update until the next tick", async () => {
    vi.useFakeTimers();
    const legacyUpdate = createDeferred<void>();
    const pollResult = createDeferred<StateSourceUpdate | undefined>();
    const applied: unknown[] = [];
    const observed: unknown[] = [];
    let legacyStarted = false;
    let shouldBlockLegacyUpdate = false;
    let pollStarted = false;
    const legacy: StateSource = {
      id: "blocking-legacy",
      initialize: async () => {},
      update: async (target) => {
        if (!shouldBlockLegacyUpdate) {
          return;
        }
        legacyStarted = true;
        await legacyUpdate.promise;
        shouldBlockLegacyUpdate = false;
        target.state.set("sharedValue", "legacy");
      },
      dispose: async () => {},
    };
    const polling: PollingStateSource = {
      id: "late-polling",
      initialize: async () => {},
      update: async () => {},
      dispose: async () => {},
      pollIntervalMs: 100_000,
      poll: async () => {
        pollStarted = true;
        return pollResult.promise;
      },
      apply: (update, target) => {
        applied.push(update.payload);
        target.state.set("sharedValue", update.payload);
      },
    };
    const runtime = new PuppetFlowRuntime()
      .use({
        id: "observer",
        process(input) {
          observed.push(input.state.get("sharedValue"));
          return {};
        },
      })
      .attachSource(legacy)
      .attachSource(polling);

    try {
      await runtime.start();
      expect(pollStarted).toBe(true);
      observed.length = 0;
      shouldBlockLegacyUpdate = true;
      runtime.state.set("forceTick", true);
      await Promise.resolve();
      expect(legacyStarted).toBe(true);

      pollResult.resolve({ payload: "polling" });
      await Promise.resolve();
      legacyUpdate.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(applied).toEqual([]);
      expect(runtime.state.get("sharedValue")).toBe("legacy");
      expect(observed).toEqual(["legacy"]);

      runtime.state.set("forceNextTick", true);
      await Promise.resolve();
      await Promise.resolve();

      expect(applied).toEqual(["polling"]);
      expect(runtime.state.get("sharedValue")).toBe("polling");
      expect(observed).toEqual(["legacy", "polling"]);
    } finally {
      await runtime.stop();
      vi.useRealTimers();
    }
  });

  it("uses legacy update behavior for a polling-shaped source attached after start", async () => {
    vi.useFakeTimers();
    let updateCalls = 0;
    let pollCalls = 0;
    let disposeCalls = 0;
    const source: PollingStateSource = {
      id: "late-attached-polling",
      initialize: async () => {},
      update: async (target) => {
        updateCalls += 1;
        target.state.set("lateAttached", "legacy-update");
      },
      dispose: async () => {
        disposeCalls += 1;
      },
      pollIntervalMs: 100_000,
      poll: async () => {
        pollCalls += 1;
        return undefined;
      },
      apply: () => {},
    };
    const runtime = new PuppetFlowRuntime();

    try {
      await runtime.start();
      runtime.attachSource(source);
      runtime.state.set("forceTick", true);
      await Promise.resolve();
      await Promise.resolve();

      expect(updateCalls).toBe(1);
      expect(runtime.state.get("lateAttached")).toBe("legacy-update");
      expect(pollCalls).toBe(0);

      await runtime.stop();
      expect(disposeCalls).toBe(1);
    } finally {
      await runtime.stop();
      vi.useRealTimers();
    }
  });

  it("aborts polling and ignores a late update before disposing its source", async () => {
    const poll = createDeferred<StateSourceUpdate | undefined>();
    const lifecycle: string[] = [];
    let signal: AbortSignal | undefined;
    let applied = 0;
    const source: PollingStateSource = {
      id: "stopped",
      initialize: async () => {},
      update: async () => {},
      dispose: async () => {
        lifecycle.push("dispose");
      },
      pollIntervalMs: 100_000,
      poll: async (nextSignal) => {
        signal = nextSignal;
        return poll.promise;
      },
      apply: () => {
        applied += 1;
      },
    };
    const runtime = new PuppetFlowRuntime().attachSource(source);

    await runtime.start();
    const stop = runtime.stop();

    expect(signal?.aborted).toBe(true);
    expect(lifecycle).toEqual([]);
    poll.resolve({ payload: "late" });
    await stop;

    expect(applied).toBe(0);
    expect(lifecycle).toEqual(["dispose"]);
  });

  it("reports polling failures with the existing source error format", async () => {
    const failure = new Error("poll failed");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const source: PollingStateSource = {
      id: "broken-poll",
      initialize: async () => {},
      update: async () => {},
      dispose: async () => {},
      pollIntervalMs: 100_000,
      poll: async () => {
        throw failure;
      },
      apply: () => {},
    };
    const runtime = new PuppetFlowRuntime().attachSource(source);

    try {
      await runtime.start();
      await vi.waitFor(() =>
        expect(error).toHaveBeenCalledWith(
          '[PuppetFlowRuntime] source "broken-poll" update failed',
          failure,
        ),
      );
    } finally {
      await runtime.stop();
      error.mockRestore();
    }
  });

  it("awaits legacy source updates before behavior evaluation", async () => {
    const update = createDeferred<void>();
    const observed: unknown[] = [];
    let updateStarted = false;
    const source: StateSource = {
      id: "legacy",
      initialize: async () => {},
      update: async (target) => {
        updateStarted = true;
        await update.promise;
        target.state.set("legacyValue", "ready");
      },
      dispose: async () => {},
    };
    const runtime = new PuppetFlowRuntime()
      .use({
        id: "observer",
        process(input) {
          observed.push(input.state.get("legacyValue"));
          return {};
        },
      })
      .attachSource(source);

    const start = runtime.start();
    await vi.waitFor(() => expect(updateStarted).toBe(true));
    expect(observed).toEqual([]);
    update.resolve();
    await start;

    expect(observed).toEqual(["ready"]);
    await runtime.stop();
  });

  it("evaluates the graph policy for inspect and process and resets on stop", async () => {
    const inspect = vi.fn(
      (_inputs: readonly MotionFrameInput[], _policy?: MotionLayerPolicy) => ({
        bones: {},
        blendShapes: {},
        parameters: {},
      }),
    );
    const process = vi.fn(
      (
        inputs: readonly MotionFrameInput[],
        _deltaTime?: number,
        _policy?: MotionLayerPolicy,
      ) => inputs[0]?.frame,
    );
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(createMotionSource("idle", 0))
      .attachMotionSource(createMotionSource("tracker", 1))
      .attachMotionPipeline({ process, inspect, reset: vi.fn() })
      .attachMotionFrameGraph(motionFrameGraph)
      .setMotionGraphSignal("tracking", true);

    await runtime.start();

    expect(process).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Number),
      expect.objectContaining({ tracker: { enabled: true, priority: 200 } }),
    );
    expect(inspect).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ tracker: { enabled: true, priority: 200 } }),
    );
    expect((inspect.mock.calls[0] as unknown[])[1]).toBe(
      (process.mock.calls[0] as unknown[])[2],
    );
    expect(runtime.getMotionFrameGraphState()?.stateId).toBe("tracking");

    await runtime.stop();

    expect(runtime.getMotionFrameGraphState()?.stateId).toBe("idle");
    await runtime.start();
    expect(runtime.getMotionFrameGraphState()?.stateId).toBe("idle");
    await runtime.stop();
  });

  it("resets graph signals when stop is called while already stopped", async () => {
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(createMotionSource("idle", 0))
      .attachMotionFrameGraph(motionFrameGraph);

    runtime.setMotionGraphSignal("tracking", true);
    await runtime.stop();
    await runtime.start();

    expect(runtime.getMotionFrameGraphState()?.stateId).toBe("idle");
    await runtime.stop();
  });

  it("resets graph state and signals when stop times out waiting for a tick", async () => {
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(createMotionSource("tracker", 1))
      .attachMotionPipeline({
        process: vi.fn((inputs) => inputs[0]?.frame),
        reset: vi.fn(),
      })
      .attachMotionFrameGraph(motionFrameGraph)
      .setMotionGraphSignal("tracking", true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await runtime.start();
      expect(runtime.getMotionFrameGraphState()?.stateId).toBe("tracking");

      (runtime as unknown as { tickInProgress: boolean }).tickInProgress = true;
      await runtime.stop();

      expect(runtime.getMotionFrameGraphState()?.stateId).toBe("idle");

      (runtime as unknown as { tickInProgress: boolean }).tickInProgress = false;
      await runtime.start();
      expect(runtime.getMotionFrameGraphState()?.stateId).toBe("idle");
      await runtime.stop();
    } finally {
      warn.mockRestore();
    }
  });

  it("keeps the legacy two-argument pipeline call when no graph is attached", async () => {
    const process = vi.fn(
      (
        inputs: readonly MotionFrameInput[],
        _deltaTime?: number,
        _policy?: MotionLayerPolicy,
      ) => inputs[0]?.frame,
    );
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(createMotionSource("idle", 0))
      .attachMotionPipeline({ process, reset: vi.fn() });

    await runtime.start();

    expect(process.mock.calls[0] as unknown[]).toHaveLength(2);
    await runtime.stop();
  });

  it("filters disabled sources on the raw adapter path", async () => {
    const updateFrame = vi.fn(async (_frame: MotionFrame) => {});
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(createMotionSource("idle", 0))
      .attachMotionSource(createMotionSource("tracker", 1))
      .attachMotionAdapter({
        id: "frame-output",
        initialize: vi.fn(async () => {}),
        updateFrame,
        dispose: vi.fn(async () => {}),
      })
      .attachMotionFrameGraph(motionFrameGraph);

    await runtime.start();

    expect(updateFrame.mock.calls.map(([frame]) => frame.timestamp)).toEqual([0]);
    await runtime.stop();
  });

  it("evaluates source connected and stale health after fail-safe updates", async () => {
    const graph: MotionFrameGraphDocument = {
      version: 1,
      initialState: "connected",
      states: [
        { id: "connected", sources: { tracker: { enabled: true } } },
        { id: "stale", sources: { tracker: { enabled: false } } },
      ],
      transitions: [
        {
          from: "connected",
          to: "stale",
          when: { type: "source", sourceId: "tracker", field: "stale", equals: true },
        },
      ],
    };
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(createMotionSource("tracker", 1))
      .attachMotionPipeline({
        process: vi.fn((inputs) => inputs[0]?.frame),
        reset: vi.fn(),
      })
      .configureMotionFailSafe({ timeoutMs: 0, action: "hold-last-frame" })
      .attachMotionFrameGraph(graph);

    await runtime.start();

    expect(runtime.getMotionFrameGraphState()?.stateId).toBe("stale");
    await runtime.stop();
  });

  it("rejects graph signals before attachment and invalid graph documents", () => {
    const runtime = new PuppetFlowRuntime();

    expect(() => runtime.setMotionGraphSignal("tracking", true)).toThrow(
      "No MotionFrameGraph is attached",
    );
    expect(() =>
      runtime.attachMotionFrameGraph({ ...motionFrameGraph, initialState: "missing" }),
    ).toThrow("MotionFrameGraph.initialState is unknown: missing");
  });

  it("fails open when graph evaluation throws and still dispatches frames", async () => {
    const process = vi.fn(
      (
        inputs: readonly MotionFrameInput[],
        _deltaTime?: number,
        _policy?: MotionLayerPolicy,
      ) => inputs[0]?.frame,
    );
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(createMotionSource("tracker", 1))
      .attachMotionPipeline({ process, reset: vi.fn() })
      .attachMotionFrameGraph(motionFrameGraph);
    const controller = (
      runtime as unknown as {
        motionFrameGraph: { evaluate: () => never };
      }
    ).motionFrameGraph;
    controller.evaluate = vi.fn(() => {
      throw new Error("graph evaluation failed");
    });

    await runtime.start();

    expect(process).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Number),
      undefined,
    );
    await runtime.stop();
  });

  it("processes latest source frames through an attached motion pipeline", async () => {
    const sourceA: MotionSource = {
      id: "source-a",
      start: vi.fn(async (emit) => emit({ timestamp: 1, parameters: { a: 1 } })),
      stop: vi.fn(async () => {}),
    };
    const sourceB: MotionSource = {
      id: "source-b",
      start: vi.fn(async (emit) => emit({ timestamp: 2, parameters: { b: 1 } })),
      stop: vi.fn(async () => {}),
    };
    const processed = { timestamp: 3, parameters: { mixed: 1 } };
    const pipeline = {
      process: vi.fn(() => processed),
      reset: vi.fn(),
    };
    const updateFrame = vi.fn(async () => {});
    const adapter: MotionFrameAdapter = {
      id: "frame-adapter",
      initialize: vi.fn(async () => {}),
      updateFrame,
      dispose: vi.fn(async () => {}),
    };
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(sourceA)
      .attachMotionSource(sourceB)
      .attachMotionPipeline(pipeline)
      .attachMotionAdapter(adapter);

    await runtime.start();

    expect(pipeline.process).toHaveBeenCalledWith(
      [
        { sourceId: "source-a", frame: expect.objectContaining({ timestamp: 1 }) },
        { sourceId: "source-b", frame: expect.objectContaining({ timestamp: 2 }) },
      ],
      expect.any(Number),
    );
    expect(updateFrame).toHaveBeenCalledWith(processed, expect.any(Number));

    await runtime.stop();
    expect(pipeline.reset).toHaveBeenCalledTimes(1);
  });

  it("isolates pipeline failures from legacy adapters", async () => {
    const legacyUpdate = vi.fn(async () => {});
    const runtime = new PuppetFlowRuntime()
      .attachMotionPipeline({
        process: vi.fn(() => {
          throw new Error("pipeline failed");
        }),
        reset: vi.fn(),
      })
      .attachAdapter(createTestAdapter(legacyUpdate));

    await runtime.start();
    expect(legacyUpdate).toHaveBeenCalled();
    await runtime.stop();
  });

  it("omits stale source frames when fail-safe disables the source", async () => {
    const process = vi.fn(() => ({ timestamp: 1, parameters: { value: 1 } }));
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource({
        id: "stale-source",
        start: vi.fn(async (emit) => emit({ timestamp: 1, parameters: { value: 1 } })),
        stop: vi.fn(async () => {}),
      })
      .attachMotionPipeline({ process, reset: vi.fn() })
      .configureMotionFailSafe({
        timeoutMs: 0,
        action: "disable-source",
      });

    await runtime.start();

    expect(process).not.toHaveBeenCalled();
    await runtime.stop();
  });

  it("holds the latest frame when fail-safe marks a source stale", async () => {
    const updateFrame = vi.fn(async () => {});
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource({
        id: "stale-source",
        start: vi.fn(async (emit) => emit({ timestamp: 1, parameters: { value: 1 } })),
        stop: vi.fn(async () => {}),
      })
      .attachMotionAdapter({
        id: "frame-adapter",
        initialize: vi.fn(async () => {}),
        updateFrame,
        dispose: vi.fn(async () => {}),
      })
      .configureMotionFailSafe({
        timeoutMs: 0,
        action: "hold-last-frame",
      });

    await runtime.start();

    expect(updateFrame).toHaveBeenCalledWith(
      expect.objectContaining({ parameters: { value: 1 } }),
      expect.any(Number),
    );
    await runtime.stop();
  });

  it("blends stale source frames to neutral immediately when configured", async () => {
    const updateFrame = vi.fn(async () => {});
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource({
        id: "stale-source",
        start: vi.fn(async (emit) => emit({ timestamp: 1, parameters: { value: 1 } })),
        stop: vi.fn(async () => {}),
      })
      .attachMotionAdapter({
        id: "frame-adapter",
        initialize: vi.fn(async () => {}),
        updateFrame,
        dispose: vi.fn(async () => {}),
      })
      .configureMotionFailSafe({
        timeoutMs: 0,
        action: "blend-to-neutral",
        transitionMs: 0,
      });

    await runtime.start();

    expect(updateFrame).toHaveBeenCalledWith(
      expect.objectContaining({ parameters: { value: 0 } }),
      expect.any(Number),
    );
    await runtime.stop();
  });

  it("does not reuse a stopped source frame on the next start", async () => {
    let startCount = 0;
    const updateFrame = vi.fn(async () => {});
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource({
        id: "one-shot-source",
        start: vi.fn(async (emit) => {
          startCount += 1;
          if (startCount === 1) {
            emit({ timestamp: 1, parameters: { value: 1 } });
          }
        }),
        stop: vi.fn(async () => {}),
      })
      .attachMotionAdapter({
        id: "frame-adapter",
        initialize: vi.fn(async () => {}),
        updateFrame,
        dispose: vi.fn(async () => {}),
      })
      .configureMotionFailSafe({
        timeoutMs: 1000,
        action: "hold-last-frame",
      });

    await runtime.start();
    await runtime.stop();
    updateFrame.mockClear();
    await runtime.start();

    expect(updateFrame).not.toHaveBeenCalled();
    await runtime.stop();
  });

  it("exposes source, mixer, and output inspector telemetry", async () => {
    const frameUpdate = vi.fn(async () => {});
    const legacyUpdate = vi.fn(async () => {});
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource({
        id: "tracking",
        start: vi.fn(async (emit) =>
          emit({ timestamp: 42, parameters: { lean: 0.5 } }),
        ),
        stop: vi.fn(async () => {}),
      })
      .attachMotionPipeline({
        process: vi.fn(() => ({ timestamp: 42, parameters: { lean: 0.5 } })),
        inspect: vi.fn(() => ({
          bones: {
            Head: [{ sourceId: "tracking", priority: 100, weight: 1 }],
          },
          blendShapes: {},
          parameters: {},
        })),
        reset: vi.fn(),
      })
      .attachMotionAdapter({
        id: "frame-output",
        initialize: vi.fn(async () => {}),
        updateFrame: frameUpdate,
        dispose: vi.fn(async () => {}),
      })
      .attachAdapter(createTestAdapter(legacyUpdate));

    await runtime.start();

    const snapshot = runtime.getMotionInspectorSnapshot();
    expect(snapshot.running).toBe(true);
    expect(snapshot.sources).toEqual([
      expect.objectContaining({
        id: "tracking",
        connected: true,
        stale: false,
        lastFrameTimestamp: 42,
      }),
    ]);
    expect(snapshot.sources[0]?.inputRateHz).toBeGreaterThan(0);
    expect(snapshot.mixer?.bones.Head).toEqual([
      { sourceId: "tracking", priority: 100, weight: 1 },
    ]);
    expect(snapshot.outputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "frame-output", connected: true }),
        expect.objectContaining({ id: "test-adapter", connected: true }),
      ]),
    );
    expect(
      snapshot.outputs.find((output) => output.id === "frame-output")?.outputRateHz,
    ).toBeGreaterThan(0);
    expect(
      snapshot.outputs.find((output) => output.id === "test-adapter")?.outputRateHz,
    ).toBeGreaterThan(0);

    await runtime.stop();

    const stopped = runtime.getMotionInspectorSnapshot();
    expect(stopped.running).toBe(false);
    expect(stopped.sources[0]).toMatchObject({
      id: "tracking",
      connected: false,
      stale: false,
      inputRateHz: 0,
    });
    expect(stopped.sources[0]?.lastFrameAt).toBeUndefined();
    expect(stopped.outputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "frame-output",
          connected: false,
          outputRateHz: 0,
        }),
        expect.objectContaining({
          id: "test-adapter",
          connected: false,
          outputRateHz: 0,
        }),
      ]),
    );
  });

  it("records output adapter failures in the inspector", async () => {
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource({
        id: "tracking",
        start: vi.fn(async (emit) => emit({ timestamp: 1, parameters: { value: 1 } })),
        stop: vi.fn(async () => {}),
      })
      .attachMotionAdapter({
        id: "broken-output",
        initialize: vi.fn(async () => {}),
        updateFrame: vi.fn(async () => {
          throw new Error("output unavailable");
        }),
        dispose: vi.fn(async () => {}),
      });

    await runtime.start();

    expect(runtime.getMotionInspectorSnapshot().outputs).toEqual([
      expect.objectContaining({
        id: "broken-output",
        connected: false,
        error: "output unavailable",
      }),
    ]);
    await runtime.stop();
  });

  it("starts motion sources and delivers latest frames in source attachment order", async () => {
    const frameA: MotionFrame = { timestamp: 1, blendShapes: { A: 0.1 } };
    const frameB: MotionFrame = { timestamp: 2, bones: { Head: {} } };
    const sourceA: MotionSource = {
      id: "source-a",
      start: vi.fn(async (emit) => emit(frameA)),
      stop: vi.fn(async () => {}),
    };
    const sourceB: MotionSource = {
      id: "source-b",
      start: vi.fn(async (emit) => emit(frameB)),
      stop: vi.fn(async () => {}),
    };
    const updateFrame = vi.fn(async (_frame: MotionFrame, _deltaTime: number) => {});
    const adapter: MotionFrameAdapter = {
      id: "frame-adapter",
      initialize: vi.fn(async () => {}),
      updateFrame,
      dispose: vi.fn(async () => {}),
    };
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(sourceA)
      .attachMotionSource(sourceB)
      .attachMotionAdapter(adapter);

    await runtime.start();

    expect(sourceA.start).toHaveBeenCalledTimes(1);
    expect(sourceB.start).toHaveBeenCalledTimes(1);
    expect(updateFrame.mock.calls.map(([frame]) => frame.timestamp)).toEqual([1, 2]);
    expect(runtime.getMotionSources()).toEqual([sourceA, sourceB]);
    expect(runtime.getMotionFrameAdapters()).toEqual([adapter]);

    await runtime.stop();

    expect(sourceA.stop).toHaveBeenCalledTimes(1);
    expect(sourceB.stop).toHaveBeenCalledTimes(1);
    expect(
      (runtime as unknown as { latestMotionFrames: Map<string, MotionFrame> })
        .latestMotionFrames.size,
    ).toBe(0);
  });

  it("starts and stops repeated MotionSource objects once by identity", async () => {
    let sharedStartCalls = 0;
    let sharedStopCalls = 0;
    let distinctStartCalls = 0;
    let distinctStopCalls = 0;
    const shared: MotionSource = {
      id: "duplicate-motion-id",
      start: async () => {
        sharedStartCalls += 1;
      },
      stop: async () => {
        sharedStopCalls += 1;
      },
    };
    const distinctSameId: MotionSource = {
      id: "duplicate-motion-id",
      start: async () => {
        distinctStartCalls += 1;
      },
      stop: async () => {
        distinctStopCalls += 1;
      },
    };
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(shared)
      .attachMotionSource(shared)
      .attachMotionSource(distinctSameId);

    await runtime.start();

    expect(sharedStartCalls).toBe(1);
    expect(distinctStartCalls).toBe(1);

    await runtime.stop();

    expect(sharedStopCalls).toBe(1);
    expect(distinctStopCalls).toBe(1);
  });

  it("dispatches and inspects a repeated MotionSource object once", async () => {
    const process = vi.fn((inputs: readonly MotionFrameInput[]) => inputs[0]?.frame);
    const inspect = vi.fn(() => ({ bones: {}, blendShapes: {}, parameters: {} }));
    const source: MotionSource = {
      id: "duplicate-projection-source",
      start: async (emit) => {
        emit({ timestamp: 1, parameters: { value: 1 } });
      },
      stop: async () => {},
    };
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(source)
      .attachMotionSource(source)
      .attachMotionPipeline({ process, inspect, reset: vi.fn() });

    await runtime.start();

    expect(process.mock.calls[0]?.[0]).toHaveLength(1);
    expect(inspect.mock.calls[0]?.[0]).toHaveLength(1);
    expect(runtime.getMotionInspectorSnapshot().sources).toHaveLength(1);

    await runtime.stop();
  });

  it("initializes and disposes one object once when it is both legacy and frame-capable", async () => {
    const adapter: Adapter & MotionFrameAdapter = {
      id: "dual-adapter",
      initialize: vi.fn(async () => {}),
      update: vi.fn(async () => {}),
      updateFrame: vi.fn(async () => {}),
      dispose: vi.fn(async () => {}),
    };
    const source: MotionSource = {
      id: "source",
      start: vi.fn(async (emit) => emit({ timestamp: 0, blendShapes: { Smile: 0.4 } })),
      stop: vi.fn(async () => {}),
    };
    const runtime = new PuppetFlowRuntime()
      .attachAdapter(adapter)
      .attachMotionAdapter(adapter)
      .attachMotionSource(source);

    await runtime.start();
    await runtime.stop();

    expect(adapter.initialize).toHaveBeenCalledTimes(1);
    expect(adapter.dispose).toHaveBeenCalledTimes(1);
    expect(adapter.update).toHaveBeenCalled();
    expect(adapter.updateFrame).toHaveBeenCalled();
  });

  it("adds plugin outputs and notifies adapters with deltaTime", async () => {
    const update = vi.fn(async () => {});
    const adapter = createTestAdapter(update);

    const runtime = new PuppetFlowRuntime()
      .use(new TestPlugin({ mouthX: 0.4 }))
      .use(new TestPlugin({ mouthX: 0.6 }))
      .attachAdapter(adapter);

    await runtime.start();

    expect(runtime.getTargetMotion().mouthX).toBe(1);
    expect(adapter.initialize).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.any(Object), expect.any(Number));

    await runtime.stop();
    expect(adapter.dispose).toHaveBeenCalledTimes(1);
  });

  it("stops adapter updates after stop is requested", async () => {
    const update = vi.fn(async () => {});
    const adapter = createTestAdapter(update);

    const runtime = new PuppetFlowRuntime().attachAdapter(adapter);
    await runtime.start();

    expect(update.mock.calls.length).toBeGreaterThan(0);

    await runtime.stop();

    const callsAtStop = update.mock.calls.length;
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    expect(update.mock.calls.length).toBe(callsAtStop);
    expect(adapter.dispose).toHaveBeenCalledTimes(1);
  });

  it("waits for in-flight tick before disposing adapters", async () => {
    let blockUpdates = false;
    let releaseBlockedUpdate: (() => void) | undefined;

    const update = vi.fn(async () => {
      if (!blockUpdates) {
        return;
      }
      await new Promise<void>((resolve) => {
        releaseBlockedUpdate = resolve;
      });
    });
    const adapter = createTestAdapter(update);

    const runtime = new PuppetFlowRuntime()
      .use(new TestPlugin({ mouthX: 0.5 }))
      .attachAdapter(adapter);

    await runtime.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    expect(update).toHaveBeenCalled();

    blockUpdates = true;
    runtime.state.set("trigger", 1);

    await vi.waitFor(() => expect(update.mock.calls.length).toBeGreaterThan(1));

    const stopPromise = runtime.stop();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    expect(adapter.dispose).not.toHaveBeenCalled();

    releaseBlockedUpdate!();
    await stopPromise;
    expect(adapter.dispose).toHaveBeenCalledTimes(1);
  });

  it("applies motion modifiers between target and rendered motion", async () => {
    const runtime = new PuppetFlowRuntime()
      .use(new TestPlugin({ mouthX: 1 }))
      .useModifier(new SmoothingModifier({ factor: 0.5 }));

    await runtime.start();

    expect(runtime.getTargetMotion().mouthX).toBe(1);
    expect(runtime.getRenderedMotion().mouthX).toBe(0.5);

    await runtime.stop();
  });

  it("supports multiple adapters simultaneously", async () => {
    const vmcUpdate = vi.fn(async () => {});
    const loggerUpdate = vi.fn(async () => {});

    const runtime = new PuppetFlowRuntime()
      .use(new TestPlugin({ mouthX: 0.3 }))
      .attachAdapter({ ...createTestAdapter(vmcUpdate), id: "vmc" })
      .attachAdapter({ ...createTestAdapter(loggerUpdate), id: "logger" });

    await runtime.start();

    expect(vmcUpdate).toHaveBeenCalled();
    expect(loggerUpdate).toHaveBeenCalled();

    await runtime.stop();
  });

  it("exposes state through runtime.state", () => {
    const runtime = new PuppetFlowRuntime();
    runtime.state.set("interest", 0.8);

    expect(runtime.state.get("interest")).toBe(0.8);
  });

  it("exposes channels and timeline APIs", async () => {
    const runtime = new PuppetFlowRuntime();
    runtime.channels.set("volume", 0.7);
    runtime.timeline.push({
      startMs: 0,
      endMs: 100,
      type: "phoneme",
      value: { phoneme: "A" },
    });

    await runtime.start();
    expect(runtime.channels.get("volume")).toBe(0.7);
    expect(runtime.getActiveTimelineEvents().length).toBeGreaterThanOrEqual(0);
    await runtime.stop();
  });

  it("exposes per-plugin outputs in the motion pipeline", async () => {
    const listener = vi.fn();
    const runtime = new PuppetFlowRuntime()
      .use(new TestPlugin({ mouthX: 0.2 }))
      .use(new TestPlugin({ mouthX: 0.6 }));

    runtime.onMotionPipelineUpdate(listener);
    await runtime.start();

    const lastCall = listener.mock.calls.at(-1)?.[0];
    const testOutputs = lastCall?.pluginOutputs.filter(
      (snapshot) => snapshot.pluginId === "test",
    );
    expect(testOutputs).toHaveLength(2);
    expect(testOutputs?.[0]?.output.mouthX).toBe(0.2);
    expect(testOutputs?.[1]?.output.mouthX).toBe(0.6);
    expect(
      lastCall?.pluginOutputs.some((snapshot) => snapshot.pluginId === "behavior"),
    ).toBe(true);
    expect(
      lastCall?.pluginOutputs.some((snapshot) => snapshot.pluginId === "graph"),
    ).toBe(true);
    expect(lastCall?.statefulSnapshot).toEqual([]);

    await runtime.stop();
  });

  it("clears stateful store when stopped", async () => {
    const runtime = new PuppetFlowRuntime().use(new GazePlugin());
    const store = (runtime as unknown as { statefulStore: StatefulStore })
      .statefulStore;

    await runtime.start();
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(store.snapshot().length).toBeGreaterThan(0);

    await runtime.stop();
    expect(store.snapshot()).toEqual([]);
  });

  it("does not run overlapping ticks while a source update is in flight", async () => {
    let activeUpdates = 0;
    let maxActiveUpdates = 0;

    const runtime = new PuppetFlowRuntime()
      .use(new TestPlugin({ mouthX: 0.5 }))
      .attachSource({
        id: "slow-source",
        initialize: vi.fn(async () => {}),
        update: vi.fn(async () => {
          activeUpdates += 1;
          maxActiveUpdates = Math.max(maxActiveUpdates, activeUpdates);
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 30);
          });
          activeUpdates -= 1;
        }),
        dispose: vi.fn(async () => {}),
      });

    await runtime.start();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 80);
    });
    await runtime.stop();

    expect(maxActiveUpdates).toBe(1);
  });

  it("does not invoke adapters after stop completes", async () => {
    const update = vi.fn(async () => {});
    const adapter = createTestAdapter(update);

    const runtime = new PuppetFlowRuntime()
      .use(new TestPlugin({ mouthX: 0.5 }))
      .attachAdapter(adapter);

    await runtime.start();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 40);
    });

    update.mockClear();
    await runtime.stop();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 40);
    });

    expect(update).not.toHaveBeenCalled();
  });

  it("applies motion overrides from sources after the pipeline", async () => {
    const update = vi.fn(async () => {});
    const adapter = createTestAdapter(update);

    const runtime = new PuppetFlowRuntime()
      .use(new TestPlugin({ mouthX: 0.1 }))
      .attachAdapter(adapter)
      .attachSource({
        id: "motion-source",
        initialize: vi.fn(async () => {}),
        update: vi.fn(async (target) => {
          target.motion.applyPayload({ mouthX: 0.9, lookX: 0.2 });
        }),
        dispose: vi.fn(async () => {}),
      });

    await runtime.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    const lastMotion = update.mock.calls.at(-1)?.[0] as MotionState | undefined;
    expect(lastMotion?.mouthX).toBe(0.9);
    expect(lastMotion?.lookX).toBe(0.2);

    await runtime.stop();
  });

  it("applies extension packs from preset extensions", async () => {
    const runtime = new PuppetFlowRuntime().loadPreset(
      loadPreset(
        JSON.stringify({
          name: "Thinking",
          version: 3,
          behavior: { type: "Block", statements: [] },
          graph: { nodes: [], edges: [] },
          extensions: {
            packs: [{ id: "thinking", config: { intensity: 0.8 } }],
          },
        }),
      ),
    );

    await runtime.start();

    expect(runtime.getRenderedMotion().lookX).not.toBe(0.5);
    const pipeline = runtime.getPluginOutputs();
    expect(pipeline.some((entry) => entry.pluginId === "extensions")).toBe(true);

    await runtime.stop();
  });

  it("executes PFScript preset behavior with channels and conditional packs", async () => {
    const loaded = loadPreset(
      JSON.stringify({
        name: "PfScriptRuntime",
        version: 3,
        behaviorPfScript: `
smile = interest * 0.4
if interest > 0.7 then
    thinking(intensity = 0.8)
end
`,
        graph: { nodes: [], edges: [] },
      }),
    );

    const runtime = new PuppetFlowRuntime().loadPreset(loaded);
    runtime.state.set("interest", 0.5);
    await runtime.start();

    expect(runtime.getTargetMotion().mouthX).toBeCloseTo(0.2, 2);
    const lowInterestLookX = runtime.getRenderedMotion().lookX;

    runtime.state.set("interest", 1);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });

    expect(runtime.getTargetMotion().mouthX).toBeCloseTo(0.4, 2);
    expect(runtime.getRenderedMotion().lookX).not.toBeCloseTo(lowInterestLookX, 2);

    await runtime.stop();
  });

  it("resolves currentPhoneme from phoneme channel for PFScript lip-sync", async () => {
    const loaded = loadPreset(
      JSON.stringify({
        name: "LipSync",
        version: 3,
        behaviorPfScript: `
if currentPhoneme == "A" then
    MouthA = 1
end
`,
        graph: { nodes: [], edges: [] },
      }),
    );

    const runtime = new PuppetFlowRuntime().loadPreset(loaded);
    runtime.channels.set("phoneme", "A");
    await runtime.start();

    expect(runtime.getTargetMotion().custom?.MouthA).toBeCloseTo(1, 2);
    expect(runtime.getRenderedMotion().custom?.MouthA).toBeCloseTo(1, 2);

    await runtime.stop();
  });
});
