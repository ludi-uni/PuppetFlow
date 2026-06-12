import type { StateStore, StateValue } from "@puppetflow/core";

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
  for (const [remoteKey, value] of Object.entries(record)) {
    if (!isStateValue(value)) {
      continue;
    }

    state.set(fieldMapping[remoteKey] ?? remoteKey, value);
  }
}
