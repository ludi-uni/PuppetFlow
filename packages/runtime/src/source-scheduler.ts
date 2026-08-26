import {
  isPollingStateSource,
  type PollingStateSource,
  type SourceUpdateTarget,
  type StateSource,
  type StateSourceUpdate,
} from "@puppetflow/source-core";

export interface StateSourceSchedulerOptions {
  onError?: (source: PollingStateSource, error: unknown) => void;
}

interface PollingSourceState {
  readonly controller: AbortController;
  readonly generation: number;
  readonly source: PollingStateSource;
  inFlight: boolean;
  latest?: StateSourceUpdate;
  loop?: Promise<void>;
}

function waitForInterval(intervalMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(finish, intervalMs);

    function finish(): void {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    }

    signal.addEventListener("abort", finish, { once: true });
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
    this.states = sources.filter(isPollingStateSource).map((source) => ({
      controller: new AbortController(),
      generation,
      source,
      inFlight: false,
    }));

    for (const state of this.states) {
      state.loop = this.run(state);
    }
  }

  drain(target: SourceUpdateTarget): void {
    for (const state of this.states) {
      this.drainState(state, target);
    }
  }

  drainSource(source: StateSource, target: SourceUpdateTarget): void {
    const state = this.states.find((candidate) => candidate.source === source);
    if (state) {
      this.drainState(state, target);
    }
  }

  stop(): Promise<void> {
    if (this.stopPromise) {
      return this.stopPromise;
    }

    const states = this.states;
    this.states = [];
    this.generation += 1;
    for (const state of states) {
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
    const update = state.latest;
    if (!update) {
      return;
    }

    state.latest = undefined;
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
