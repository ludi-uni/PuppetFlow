export {
  TauriVmcAdapter,
  setTauriOscEnabled,
  isTauriOscEnabled,
} from "./tauri-vmc-adapter.js";
export { TauriOscAdapter } from "./tauri-osc-adapter.js";
export {
  encodeBlendShapeApplyMessage,
  encodeBlendShapeMessage,
  encodeBonePoseMessage,
} from "./osc-encoder.js";
export {
  encodeOscBundle,
  resolveOscTimetag,
  type OscTimetagOptions,
  type VmcBundleTimetagMode,
} from "./osc-bundle.js";
export {
  DEFAULT_VMC_HOST,
  DEFAULT_VMC_PORT,
  type VmcAdapterConfig,
  type VmcMapping,
  type VmcOutputConfig,
  type VmcTimestampMode,
} from "./types.js";
