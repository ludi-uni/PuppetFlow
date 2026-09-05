import type { CallToolResult } from "@modelcontextprotocol/server";
import type { ControlResult, PuppetFlowControlState } from "@puppetflow/control";
import { normalizeState } from "./control.js";
import { BridgeError } from "./errors.js";

type JsonObject = Record<string, unknown>;
const MAX_RUNTIME_REASON_LENGTH = 256;
const DEFAULT_REJECTION_REASON = "Acting runtime rejected the command";
const ERROR_CLASS_PREFIX_PATTERN = /^(?:Error|[A-Za-z_$][\w$]*Error):\s*/;
const WINDOWS_PATH_PATTERN = /(?:[A-Za-z]:[\\/]|\\\\)[^\r\n]*/g;
const POSIX_PATH_PATTERN = /(?<![A-Za-z0-9])\/[^\r\n]*/g;
const SENSITIVE_ASSIGNMENT_PATTERN =
  /(?:\b(?:api[_-]?key|authorization|credential|password|secret|token)\b|["'](?:api[_-]?key|authorization|credential|password|secret|token)["'])\s*([=:])\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}]+)/gi;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[^\s,;]+/gi;

export function jsonResult(value: JsonObject): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

export function errorResult(error: BridgeError): CallToolResult {
  return {
    ...jsonResult({
      error: { code: error.code, message: error.message, ...error.details },
    }),
    isError: true,
  };
}

export function commandResult(
  result: ControlResult,
  extra: JsonObject = {},
): CallToolResult {
  if (!result.accepted) {
    return errorResult(
      new BridgeError("command_rejected", runtimeRejectionReason(result.reason), extra),
    );
  }
  return jsonResult({
    accepted: true,
    action_id: result.state.acting.activeActionId ?? null,
    sequence_id: result.state.acting.sequenceId ?? null,
    state: normalizeState(result.state),
    ...extra,
  });
}

export function stateResult(state: PuppetFlowControlState): CallToolResult {
  return jsonResult({ ...normalizeState(state) });
}

function runtimeRejectionReason(reason: string | undefined): string {
  const firstLine = reason?.split(/[\r\n]/, 1)[0]?.trim();
  if (!firstLine) return DEFAULT_REJECTION_REASON;
  const sanitized = firstLine
    .replace(ERROR_CLASS_PREFIX_PATTERN, "")
    .replace(BEARER_TOKEN_PATTERN, "Bearer [redacted]")
    .replace(
      SENSITIVE_ASSIGNMENT_PATTERN,
      (_, separator: string) => `redacted${separator}[redacted]`,
    )
    .replace(WINDOWS_PATH_PATTERN, "[redacted path]")
    .replace(POSIX_PATH_PATTERN, "[redacted path]")
    .replace(/\s+/g, " ")
    .trim();
  if (!sanitized) return DEFAULT_REJECTION_REASON;
  return sanitized.length <= MAX_RUNTIME_REASON_LENGTH
    ? sanitized
    : `${sanitized.slice(0, MAX_RUNTIME_REASON_LENGTH - 1).trimEnd()}…`;
}
