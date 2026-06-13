export class PfScriptParseError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(message: string, line: number, column: number) {
    super(`${message} (${line}:${column})`);
    this.name = "PfScriptParseError";
    this.line = line;
    this.column = column;
  }
}
