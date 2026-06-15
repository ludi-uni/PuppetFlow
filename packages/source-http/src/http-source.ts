import { applyInputPayload } from "@puppetflow/source-core";
import type { SourceUpdateTarget, StateSource } from "@puppetflow/source-core";

export interface HttpSourceConfig {
  url: string;
  intervalMs?: number;
  timeoutMs?: number;
  fieldMapping?: Record<string, string>;
}

export class HttpSource implements StateSource {
  readonly id = "http";

  private readonly url: string;
  private readonly intervalMs: number;
  private readonly timeoutMs: number;
  private readonly fieldMapping: Record<string, string>;
  private lastFetchedAt = 0;
  private inFlightAbort: AbortController | null = null;

  constructor(config: HttpSourceConfig) {
    this.url = config.url;
    this.intervalMs = config.intervalMs ?? 1000;
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

    this.inFlightAbort?.abort();
    const abortController = new AbortController();
    this.inFlightAbort = abortController;
    const timeoutId = setTimeout(() => abortController.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.url, {
        signal: abortController.signal,
      });
      if (!response.ok) {
        throw new Error(
          `HTTP source failed: ${response.status} ${response.statusText}`,
        );
      }

      const payload: unknown = await response.json();
      applyInputPayload(target, payload, this.fieldMapping);
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (this.inFlightAbort === abortController) {
        this.inFlightAbort = null;
      }
    }
  }

  async dispose(): Promise<void> {
    this.inFlightAbort?.abort();
    this.inFlightAbort = null;
  }
}
