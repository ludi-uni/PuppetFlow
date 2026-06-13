import type { ChannelStore, MotionState, StateStore } from "@puppetflow/core";

import type { TimelineEvent } from "@puppetflow/core";

export interface BehaviorExecutionContext {
  state: StateStore;
  channels: ChannelStore;
  renderedMotion: MotionState;
  deltaTime: number;
  /** Elapsed preset time in seconds (PFScript `time`). */
  time?: number;
  /** Active phoneme override. Falls back to channel `phoneme` / timeline events. */
  currentPhoneme?: string;
  /** Active timeline events for `eventActive()` and phoneme resolution. */
  activeTimelineEvents?: readonly TimelineEvent[];
}
