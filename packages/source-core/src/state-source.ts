import type { ChannelStore, StateStore, TimelineStore } from "@puppetflow/core";
import type { MotionOverrideStore } from "./motion-override-store.js";

export interface MicroBehaviorInputHandler {
  applyFromInputRecord(record: Record<string, unknown>): void;
}

export interface SourceUpdateTarget {
  state: StateStore;
  channels: ChannelStore;
  timeline: TimelineStore;
  motion: MotionOverrideStore;
  microBehavior?: MicroBehaviorInputHandler;
}

export interface StateSource {
  readonly id: string;
  initialize(): Promise<void>;
  update(target: SourceUpdateTarget): Promise<void>;
  dispose(): Promise<void>;
}

export interface StateSourceUpdate {
  readonly payload: unknown;
  readonly fieldMapping?: Readonly<Record<string, string>>;
}

export interface PollingStateSource extends StateSource {
  readonly pollIntervalMs: number;
  poll(signal: AbortSignal): Promise<StateSourceUpdate | undefined>;
  apply(update: StateSourceUpdate, target: SourceUpdateTarget): void;
}

export function isPollingStateSource(
  source: StateSource,
): source is PollingStateSource {
  try {
    const candidate = source as Partial<PollingStateSource>;
    const pollIntervalMs = candidate.pollIntervalMs;
    return (
      typeof pollIntervalMs === "number" &&
      Number.isFinite(pollIntervalMs) &&
      pollIntervalMs >= 0 &&
      typeof candidate.poll === "function" &&
      typeof candidate.apply === "function"
    );
  } catch {
    return false;
  }
}
