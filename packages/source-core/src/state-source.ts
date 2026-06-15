import type {
  ChannelStore,
  StateStore,
  TimelineStore,
} from "@puppetflow/core";
import type { MotionOverrideStore } from "./motion-override-store.js";

export interface SourceUpdateTarget {
  state: StateStore;
  channels: ChannelStore;
  timeline: TimelineStore;
  motion: MotionOverrideStore;
}

export interface StateSource {
  readonly id: string;
  initialize(): Promise<void>;
  update(target: SourceUpdateTarget): Promise<void>;
  dispose(): Promise<void>;
}
