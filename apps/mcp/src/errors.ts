export type BridgeErrorCode =
  | "invalid_input"
  | "command_rejected"
  | "command_outcome_unknown"
  | "runtime_unavailable"
  | "internal_error";

export class BridgeError extends Error {
  constructor(
    readonly code: BridgeErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "BridgeError";
  }
}
