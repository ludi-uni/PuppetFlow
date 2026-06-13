export type TokenType =
  | "identifier"
  | "number"
  | "string"
  | "true"
  | "false"
  | "if"
  | "then"
  | "elseif"
  | "else"
  | "end"
  | "and"
  | "or"
  | "not"
  | "forbidden"
  | "plus"
  | "minus"
  | "star"
  | "slash"
  | "percent"
  | "eq"
  | "eqeq"
  | "ne"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "lparen"
  | "rparen"
  | "comma"
  | "dot"
  | "newline"
  | "eof";

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}
