import type { VmcTimestampMode } from "./types.js";

export type { VmcTimestampMode } from "./types.js";

export type VmcBundleTimetagMode = VmcTimestampMode;

export interface OscTimetagOptions {
  mode?: VmcBundleTimetagMode;
  /** Unix timestamp in milliseconds. Required for `frame-unix`. */
  timestampMs?: number;
  /** Injectable send time for deterministic tests; defaults to Date.now(). */
  nowMs?: number;
}

const NTP_EPOCH_OFFSET_SECONDS = 2_208_988_800;

function writeUint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, false);
  return bytes;
}

function unixMillisecondsToNtp(timestampMs: number): Uint8Array {
  if (!Number.isFinite(timestampMs) || timestampMs < 0) {
    throw new RangeError("OSC Unix timestamps must be finite and non-negative");
  }

  const wholeMilliseconds = Math.floor(timestampMs);
  const seconds = Math.floor(wholeMilliseconds / 1000) + NTP_EPOCH_OFFSET_SECONDS;
  const milliseconds = wholeMilliseconds % 1000;
  const fraction = Math.floor((milliseconds / 1000) * 0x1_0000_0000);
  const output = new Uint8Array(8);
  output.set(writeUint32(seconds), 0);
  output.set(writeUint32(fraction), 4);
  return output;
}

export function resolveOscTimetag(options: OscTimetagOptions = {}): Uint8Array {
  const mode = options.mode ?? "send-time";
  if (mode === "immediate") {
    return new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]);
  }

  if (mode === "frame-unix") {
    if (options.timestampMs === undefined) {
      throw new RangeError("frame-unix requires a Unix timestamp");
    }
    return unixMillisecondsToNtp(options.timestampMs);
  }

  return unixMillisecondsToNtp(options.nowMs ?? Date.now());
}

export function encodeOscBundle(
  messages: Uint8Array[],
  timetag: OscTimetagOptions = {},
): Uint8Array {
  const tag = resolveOscTimetag(timetag);
  const totalLength =
    16 + messages.reduce((total, message) => total + 4 + message.length, 0);
  const bundle = new Uint8Array(totalLength);
  bundle.set(new TextEncoder().encode("#bundle\0"), 0);
  bundle.set(tag, 8);

  const view = new DataView(bundle.buffer, bundle.byteOffset, bundle.byteLength);
  let offset = 16;
  for (const message of messages) {
    view.setUint32(offset, message.length, false);
    offset += 4;
    bundle.set(message, offset);
    offset += message.length;
  }

  return bundle;
}
