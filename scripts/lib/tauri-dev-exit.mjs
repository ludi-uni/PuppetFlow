export function isBenignTauriDevExit(code, strictMode = false) {
  if (strictMode) {
    return code === null || code === 0;
  }
  if (code === null || code === 0) {
    return true;
  }
  // Windows: UINT32 representation of -1 when the Tauri window is closed in dev.
  if (code === 4294967295) {
    return true;
  }
  const signed = code | 0;
  // -1 / 255 on Windows; 130 (SIGINT) and 143 (SIGTERM) are common on Linux/macOS dev teardown.
  return signed === -1 || signed === 255 || signed === 130 || signed === 143;
}

export function isBenignTauriDevSignal(signal) {
  return signal === "SIGINT" || signal === "SIGTERM";
}
