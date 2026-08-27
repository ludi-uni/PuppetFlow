import type { ChannelStore, MotionState, StateStore } from "@puppetflow/core";

import type { TimelineEvent } from "@puppetflow/core";

export interface BehaviorExecutionContext {
  state: StateStore;
  channels: ChannelStore;
  renderedMotion: MotionState;
  deltaTime: number;
  /** Elapsed preset time in seconds (PFScript `time`). */
  time?: number;
  frameNumber?: number;
  /** Active phoneme override. Falls back to channel `phoneme` / timeline events. */
  currentPhoneme?: string;
  /** Active timeline events for `eventActive()` and phoneme resolution. */
  activeTimelineEvents?: readonly TimelineEvent[];
  /** Extension registry scalar functions available to PFScript expressions. */
  evaluateExtensionFunction?: (
    name: string,
    args: Record<string, number>,
  ) => number | undefined;
  statefulStore?: import("@puppetflow/stateful-core").StatefulStore;
  statefulRegistry?: import("@puppetflow/stateful-core").StatefulRegistry;
  frame?: import("@puppetflow/stateful-core").FrameContext;
}
