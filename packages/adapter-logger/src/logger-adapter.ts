import type { Adapter } from "@puppetflow/adapter-core";
import type { MotionState } from "@puppetflow/core";

export interface LoggerAdapterConfig {
  throttleMs?: number;
  label?: string;
}

export class LoggerAdapter implements Adapter {
  readonly id = "logger";

  private readonly throttleMs: number;
  private readonly label: string;
  private lastLoggedAt = 0;

  constructor(config: LoggerAdapterConfig = {}) {
    this.throttleMs = config.throttleMs ?? 1000;
    this.label = config.label ?? "PuppetFlow";
  }

  async initialize(): Promise<void> {}

  async update(motion: MotionState, deltaTime: number): Promise<void> {
    const now = Date.now();
    if (now - this.lastLoggedAt < this.throttleMs) {
      return;
    }

    this.lastLoggedAt = now;
    console.log(`[${this.label}]`, { motion, deltaTime });
  }

  async dispose(): Promise<void> {}
}
