import type { ChannelStore } from "./channel-store.js";
import type { MotionState } from "./motion-state.js";
import type { StateStore } from "./state-store.js";

export interface PluginInputStores {
  state: StateStore;
  channels: ChannelStore;
}

export interface BehaviorPluginContext {
  deltaTime: number;
  time: number;
  frame?: {
    deltaTime: number;
    frameNumber: number;
    elapsedTime: number;
  };
  runStatefulNumber?: (
    functionName: string,
    instanceId: string,
    config?: Record<string, number | string>,
    input?: number,
  ) => number | undefined;
}

export interface BehaviorPlugin {
  id: string;
  process(
    input: PluginInputStores,
    motion: MotionState,
    context?: BehaviorPluginContext,
  ): Partial<MotionState>;
}
