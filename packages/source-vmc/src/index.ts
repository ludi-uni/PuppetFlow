export { decodeVmcPacket, type DecodedVmcEvent } from "./osc-decoder.js";
export {
  applyVmcEvents,
  createVmcFrameState,
  type VmcFrameState,
} from "./normalize.js";
export {
  VMC_INPUT_PROFILE_IDS,
  VMC_INPUT_PROFILES,
  resolveVmcInputProfile,
  type VmcInputProfile,
  type VmcInputProfileId,
  type VmcInputProfileOverrides,
  type VmcRootPolicy,
} from "./profiles.js";
