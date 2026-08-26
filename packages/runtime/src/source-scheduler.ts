import {
  isPollingStateSource,
  type PollingStateSource,
  type SourceUpdateTarget,
  type StateSource,
  type StateSourceUpdate,
} from "@puppetflow/source-core";

const MAX_TIMER_DELAY_MS = 2_147_483_647;

export interface StateSourceSchedulerOptions {
  onError?: (source: PollingStateSource, error: unknown) => void;
}

interface PollingSourceState {
  readonly controller: AbortController;
  readonly generation: number;
  readonly source: PollingStateSource;
  captureActive: boolean;
  captured?: StateSourceUpdate;
  inFlight: boolean;
  latest?: StateSourceUpdate;
  readonly loop: Promise<void>;
  readonly rejectLoop: (reason?: unknown) => void;
  readonly resolveLoop: () => void;
}

function waitForInterval(intervalMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let remaining = intervalMs;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    function finish(): void {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
      signal.removeEventListener("abort", finish);
      resolve();
    }

    function waitForNextChunk(): void {
      const delay = Math.min(remaining, MAX_TIMER_DELAY_MS);
      timeout = setTimeout(() => {
        remaining -= delay;
        if (remaining <= 0) {
          finish();
          return;
        }
        waitForNextChunk();
      }, delay);
    }

    signal.addEventListener("abort", finish, { once: true });
    waitForNextChunk();
  });
}

export class StateSourceScheduler {
  private generation = 0;
  private states: PollingSourceState[] = [];
  private stopPromise: Promise<void> | undefined;

  constructor(private readonly options: StateSourceSchedulerOptions = {}) {}

  start(sources: readonly StateSource[]): void {
    if (this.states.length > 0 || this.stopPromise) {
      return;
    }

    const generation = ++this.generation;
    const pollingSources = new Set<PollingStateSource>();
    this.states = [];
    for (const source of sources) {
      if (!isPollingStateSource(source) || pollingSources.has(source)) {
        continue;
      }

      pollingSources.add(source);
      let resolveLoop!: () => void;
      let rejectLoop!: (reason?: unknown) => void;
      const loop = new Promise<void>((resolve, reject) => {
        resolveLoop = resolve;
        rejectLoop = reject;
      });
      this.states.push({
        controller: new AbortController(),
        generation,
        source,
        captureActive: false,
        inFlight: false,
        loop,
        rejectLoop,
        resolveLoop,
      });
    }

    for (const state of this.states) {
      void this.run(state).then(state.resolveLoop, state.rejectLoop);
    }
  }

  capture(): void {
    for (const state of this.states) {
      state.captured = state.latest;
      state.latest = undefined;
      state.captureActive = true;
    }
  }

  drain(target: SourceUpdateTarget): void {
    this.capture();
    for (const state of this.states) {
      this.drainState(state, target);
    }
  }

  drainSource(source: StateSource, target: SourceUpdateTarget): boolean {
    const state = this.states.find((candidate) => candidate.source === source);
    if (!state) {
      return false;
    }

    this.drainState(state, target);
    return true;
  }

  stop(): Promise<void> {
    if (this.stopPromise) {
      return this.stopPromise;
    }

    const states = this.states;
    this.states = [];
    this.generation += 1;
    for (const state of states) {
      state.captureActive = false;
      state.captured = undefined;
      state.latest = undefined;
      state.controller.abort();
    }

    this.stopPromise = Promise.all(states.map((state) => state.loop)).then(() => {
      this.stopPromise = undefined;
    });
    return this.stopPromise;
  }

  private async run(state: PollingSourceState): Promise<void> {
    while (this.isCurrent(state)) {
      state.inFlight = true;
      try {
        const update = await state.source.poll(state.controller.signal);
        if (update && this.isCurrent(state)) {
          state.latest = update;
        }
      } catch (error) {
        if (this.isCurrent(state)) {
          this.options.onError?.(state.source, error);
        }
      } finally {
        state.inFlight = false;
      }

      if (!this.isCurrent(state)) {
        return;
      }

      await waitForInterval(state.source.pollIntervalMs, state.controller.signal);
    }
  }

  private drainState(state: PollingSourceState, target: SourceUpdateTarget): void {
    const update = state.captureActive ? state.captured : state.latest;
    if (!update) {
      return;
    }

    if (state.captureActive) {
      state.captured = undefined;
    } else {
      state.latest = undefined;
    }
    try {
      state.source.apply(update, target);
    } catch (error) {
      this.options.onError?.(state.source, error);
    }
  }

  private isCurrent(state: PollingSourceState): boolean {
    return (
      state.generation === this.generation &&
      !state.controller.signal.aborted &&
      this.states.includes(state)
    );
  }
}
