import { PfScriptParseError } from "./errors.js";
import { FORBIDDEN_KEYWORDS } from "./forbidden.js";
import type { Token, TokenType } from "./tokens.js";

const KEYWORDS: Record<string, TokenType> = {
  if: "if",
  then: "then",
  elseif: "elseif",
  else: "else",
  end: "end",
  and: "and",
  or: "or",
  not: "not",
  true: "true",
  false: "false",
};

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let line = 1;
  let column = 1;
  let index = 0;

  const peek = (offset = 0): string => source[index + offset] ?? "";
  const advance = (count = 1): string => {
    let consumed = "";
    for (let i = 0; i < count; i += 1) {
      const char = source[index];
      if (char === undefined) {
        break;
      }
      consumed += char;
      if (char === "\n") {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
      index += 1;
    }
    return consumed;
  };

  const push = (
    type: TokenType,
    value: string,
    tokenLine: number,
    tokenColumn: number,
  ) => {
    tokens.push({ type, value, line: tokenLine, column: tokenColumn });
  };

  while (index < source.length) {
    const char = peek();

    if (char === " " || char === "\t" || char === "\r") {
      advance();
      continue;
    }

    if (char === "\n") {
      push("newline", "\n", line, column);
      advance();
      continue;
    }

    if (char === "-" && peek(1) === "-") {
      while (index < source.length && peek() !== "\n") {
        advance();
      }
      continue;
    }

    const startLine = line;
    const startColumn = column;

    if (char === "(") {
      push("lparen", "(", startLine, startColumn);
      advance();
      continue;
    }
    if (char === ")") {
      push("rparen", ")", startLine, startColumn);
      advance();
      continue;
    }
    if (char === ",") {
      push("comma", ",", startLine, startColumn);
      advance();
      continue;
    }
    if (char === ".") {
      push("dot", ".", startLine, startColumn);
      advance();
      continue;
    }
    if (char === "+") {
      push("plus", "+", startLine, startColumn);
      advance();
      continue;
    }
    if (char === "-") {
      push("minus", "-", startLine, startColumn);
      advance();
      continue;
    }
    if (char === "*") {
      push("star", "*", startLine, startColumn);
      advance();
      continue;
    }
    if (char === "/") {
      push("slash", "/", startLine, startColumn);
      advance();
      continue;
    }
    if (char === "%") {
      push("percent", "%", startLine, startColumn);
      advance();
      continue;
    }
    if (char === "=" && peek(1) === "=") {
      push("eqeq", "==", startLine, startColumn);
      advance(2);
      continue;
    }
    if (char === "=") {
      push("eq", "=", startLine, startColumn);
      advance();
      continue;
    }
    if (char === "!" && peek(1) === "=") {
      push("ne", "!=", startLine, startColumn);
      advance(2);
      continue;
    }
    if (char === ">" && peek(1) === "=") {
      push("gte", ">=", startLine, startColumn);
      advance(2);
      continue;
    }
    if (char === "<" && peek(1) === "=") {
      push("lte", "<=", startLine, startColumn);
      advance(2);
      continue;
    }
    if (char === ">") {
      push("gt", ">", startLine, startColumn);
      advance();
      continue;
    }
    if (char === "<") {
      push("lt", "<", startLine, startColumn);
      advance();
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = advance();
      let value = "";
      while (index < source.length && peek() !== quote) {
        if (peek() === "\\" && peek(1)) {
          advance();
          value += advance();
          continue;
        }
        value += advance();
      }
      if (peek() !== quote) {
        throw new PfScriptParseError(
          "Unterminated string literal",
          startLine,
          startColumn,
        );
      }
      advance();
      push("string", value, startLine, startColumn);
      continue;
    }

    if (char >= "0" && char <= "9") {
      let value = advance();
      while (/[0-9.]/.test(peek())) {
        value += advance();
      }
      push("number", value, startLine, startColumn);
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let value = advance();
      while (/[A-Za-z0-9_]/.test(peek())) {
        value += advance();
      }
      const lower = value.toLowerCase();
      if (FORBIDDEN_KEYWORDS.has(lower)) {
        push("forbidden", lower, startLine, startColumn);
        continue;
      }
      const keyword = KEYWORDS[lower];
      if (keyword) {
        push(keyword, lower, startLine, startColumn);
        continue;
      }
      push("identifier", value, startLine, startColumn);
      continue;
    }

    throw new PfScriptParseError(
      `Unexpected character: ${char}`,
      startLine,
      startColumn,
    );
  }

  push("eof", "", line, column);
  return tokens;
}
