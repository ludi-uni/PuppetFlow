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

    const response = await fetch(this.url, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`HTTP source failed: ${response.status} ${response.statusText}`);
    }

    const payload: unknown = await response.json();
    applyInputPayload(target, payload, this.fieldMapping);
  }

  async dispose(): Promise<void> {}
}
