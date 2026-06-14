export type { BehaviorPlugin, BehaviorPluginContext, PluginInputStores } from "./behavior-plugin.js";
export {
  OFFICIAL_CHANNEL_KEYS,
  type AudioChannel,
  type ChannelValue,
  type LipSyncChannel,
  type OfficialChannelKey,
} from "./channel.js";
export { ChannelStore, type ChannelListener } from "./channel-store.js";
export {
  clamp01,
  DEFAULT_MOTION_STATE,
  LEGACY_MOTION_KEY_REPLACEMENTS,
  migrateLegacyMotionKey,
  MOTION_STATE_KEYS,
  PLUGIN_MOTION_OUTPUTS,
  type MotionState,
  type MotionStateKey,
} from "./motion-state.js";
export { createEmptyMotionState, addMotionState, mergeMotionState } from "./merge-motion-state.js";
export { StateStore, type StateValue } from "./state-store.js";
export {
  DEFAULT_PHONEME_SHAPES,
  PHONEME_KEYS,
  getPhonemeShape,
  resolvePhoneme,
  type PhonemeKey,
  type PhonemeShape,
} from "./phoneme-shapes.js";
export {
  lipSyncEventToTimelineEvent,
  type LipSyncEvent,
  type TimelineEvent,
} from "./timeline.js";
export { DEFAULT_MAX_TIMELINE_EVENTS, TimelineStore } from "./timeline-store.js";
