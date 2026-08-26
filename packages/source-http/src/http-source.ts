import { applyInputPayload } from "@puppetflow/source-core";
import type {
  PollingStateSource,
  SourceUpdateTarget,
  StateSourceUpdate,
} from "@puppetflow/source-core";

class HttpSourceTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`HTTP source timed out after ${timeoutMs}ms`);
    this.name = "HttpSourceTimeoutError";
  }
}

export interface HttpSourceConfig {
  url: string;
  intervalMs?: number;
  timeoutMs?: number;
  fieldMapping?: Record<string, string>;
}

export class HttpSource implements PollingStateSource {
  readonly id = "http";
  readonly pollIntervalMs: number;

  private readonly url: string;
  private readonly intervalMs: number;
  private readonly timeoutMs: number;
  private readonly fieldMapping: Readonly<Record<string, string>>;
  private lastFetchedAt = 0;
  private inFlightUpdateAbort: AbortController | null = null;
  private inFlightPollAbort: AbortController | null = null;

  constructor(config: HttpSourceConfig) {
    const intervalMs = config.intervalMs ?? 1000;
    if (!Number.isFinite(intervalMs) || intervalMs < 0) {
      throw new Error("HTTP source intervalMs must be a finite, non-negative number");
    }

    this.url = config.url;
    this.intervalMs = intervalMs;
    this.pollIntervalMs = this.intervalMs;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.fieldMapping = config.fieldMapping ?? {};
  }

  async initialize(): Promise<void> {}

  async update(target: SourceUpdateTarget): Promise<void> {
    const now = Date.now();
    if (now - this.lastFetchedAt < this.intervalMs) {
      return;
    }

    this.lastFetchedAt = now;

    this.inFlightUpdateAbort?.abort();
    const abortController = new AbortController();
    this.inFlightUpdateAbort = abortController;

    try {
      const payload = await this.fetchPayload(abortController);
      applyInputPayload(target, payload, this.fieldMapping);
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      throw error;
    } finally {
      if (this.inFlightUpdateAbort === abortController) {
        this.inFlightUpdateAbort = null;
      }
    }
  }

  async poll(signal: AbortSignal): Promise<StateSourceUpdate | undefined> {
    if (signal.aborted) {
      return undefined;
    }

    this.inFlightPollAbort?.abort();
    const abortController = new AbortController();
    const abortPoll = () => abortController.abort();
    signal.addEventListener("abort", abortPoll, { once: true });
    this.inFlightPollAbort = abortController;

    try {
      const payload = await this.fetchPayload(abortController);
      if (abortController.signal.aborted) {
        return undefined;
      }

      return { payload, fieldMapping: this.fieldMapping };
    } catch (error) {
      if (error instanceof HttpSourceTimeoutError) {
        throw error;
      }

      if (abortController.signal.aborted) {
        return undefined;
      }

      throw error;
    } finally {
      signal.removeEventListener("abort", abortPoll);
      if (this.inFlightPollAbort === abortController) {
        this.inFlightPollAbort = null;
      }
    }
  }

  apply(update: StateSourceUpdate, target: SourceUpdateTarget): void {
    applyInputPayload(target, update.payload, update.fieldMapping ?? this.fieldMapping);
  }

  async dispose(): Promise<void> {
    this.inFlightUpdateAbort?.abort();
    this.inFlightPollAbort?.abort();
    this.inFlightUpdateAbort = null;
    this.inFlightPollAbort = null;
  }

  private async fetchPayload(abortController: AbortController): Promise<unknown> {
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      if (abortController.signal.aborted) {
        return;
      }

      timedOut = true;
      abortController.abort();
    }, this.timeoutMs);

    try {
      const response = await fetch(this.url, {
        signal: abortController.signal,
      });
      if (!response.ok) {
        throw new Error(
          `HTTP source failed: ${response.status} ${response.statusText}`,
        );
      }

      return await response.json();
    } catch (error) {
      if (timedOut) {
        throw new HttpSourceTimeoutError(this.timeoutMs);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
