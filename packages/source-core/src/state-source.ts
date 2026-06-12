import type { ChannelStore, StateStore, TimelineStore } from "@puppetflow/core";

export interface SourceUpdateTarget {
  state: StateStore;
  channels: ChannelStore;
  timeline: TimelineStore;
}

export interface StateSource {
  readonly id: string;
  initialize(): Promise<void>;
  update(target: SourceUpdateTarget): Promise<void>;
  dispose(): Promise<void>;
}
