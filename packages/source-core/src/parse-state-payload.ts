import type { StateStore, StateValue } from "@puppetflow/core";

export const MAX_STATE_KEYS_PER_PAYLOAD = 128;

function isStateValue(value: unknown): value is StateValue {
  return (
    typeof value === "number" || typeof value === "string" || typeof value === "boolean"
  );
}

export function applyStatePayload(
  state: StateStore,
  payload: unknown,
  fieldMapping: Record<string, string> = {},
): void {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("State payload must be a JSON object");
  }

  const record = payload as Record<string, unknown>;
  const entries = Object.entries(record);
  if (entries.length > MAX_STATE_KEYS_PER_PAYLOAD) {
    throw new Error(`state exceeds max keys (${MAX_STATE_KEYS_PER_PAYLOAD})`);
  }

  for (const [remoteKey, value] of entries) {
    if (!isStateValue(value)) {
      continue;
    }

    state.set(fieldMapping[remoteKey] ?? remoteKey, value);
  }
}
