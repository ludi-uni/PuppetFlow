import type { ChannelStore } from "./channel-store.js";
import type { MotionState } from "./motion-state.js";
import type { StateStore } from "./state-store.js";

export interface PluginInputStores {
  state: StateStore;
  channels: ChannelStore;
}

export interface BehaviorPlugin {
  id: string;
  process(input: PluginInputStores, motion: MotionState): Partial<MotionState>;
}
