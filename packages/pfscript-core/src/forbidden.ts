import { PfScriptParseError } from "./errors.js";

/** Keywords that must never appear as statements or bindings (M1 fence). */
export const FORBIDDEN_KEYWORDS = new Set([
  "while",
  "repeat",
  "for",
  "goto",
  "require",
  "function",
  "local",
  "return",
  "break",
  "do",
  "table",
  "metatable",
  "class",
  "module",
]);

export const FORBIDDEN_IDENTIFIER_PREFIXES = ["os", "io", "debug"] as const;

export class PfScriptForbiddenError extends PfScriptParseError {
  constructor(token: string, line: number, column: number) {
    super(`Forbidden keyword or identifier: ${token}`, line, column);
    this.name = "PfScriptForbiddenError";
  }
}

export function assertIdentifierAllowed(
  name: string,
  line: number,
  column: number,
): void {
  if (FORBIDDEN_KEYWORDS.has(name)) {
    throw new PfScriptForbiddenError(name, line, column);
  }

  for (const prefix of FORBIDDEN_IDENTIFIER_PREFIXES) {
    if (name === prefix) {
      throw new PfScriptForbiddenError(`${name}.*`, line, column);
    }
  }
}
