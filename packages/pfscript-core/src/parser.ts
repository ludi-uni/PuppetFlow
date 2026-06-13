import type {
  PfScriptBinaryOp,
  PfScriptExpression,
  PfScriptIf,
  PfScriptNamedArg,
  PfScriptProgram,
  PfScriptStatement,
} from "./ast.js";
import { PfScriptParseError } from "./errors.js";
import { assertIdentifierAllowed, FORBIDDEN_IDENTIFIER_PREFIXES } from "./forbidden.js";
import { tokenize } from "./lexer.js";
import type { Token } from "./tokens.js";

export function parsePfScript(source: string): PfScriptProgram {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  return parser.parseProgram();
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parseProgram(): PfScriptProgram {
    const body = this.parseBlock();
    this.skipExtraNewlines();
    const token = this.peek();
    if (token.type !== "eof") {
      throw this.error(`Expected end of file, got ${token.type}`, token);
    }
    return { type: "Program", body };
  }

  parseBlock(): PfScriptStatement[] {
    const statements: PfScriptStatement[] = [];

    while (this.isStatementStart()) {
      statements.push(this.parseStatement());
    }

    return statements;
  }

  private parseStatement(): PfScriptStatement {
    const token = this.peek();

    if (token.type === "forbidden") {
      throw new PfScriptParseError(
        `Forbidden keyword: ${token.value}`,
        token.line,
        token.column,
      );
    }

    if (token.type === "if") {
      return this.parseIf();
    }

    if (token.type === "identifier") {
      const next = this.tokens[this.index + 1];
      if (next?.type === "eq") {
        return this.parseAssign();
      }
      if (next?.type === "lparen") {
        return this.parseCallStatement();
      }
      throw this.error(`Expected assignment or call after '${token.value}'`, token);
    }

    throw this.error(`Unexpected token in statement: ${token.type}`, token);
  }

  private parseAssign(): PfScriptStatement {
    const targetToken = this.advance();
    if (targetToken.type !== "identifier") {
      throw this.error("Expected assignment target identifier", targetToken);
    }
    assertIdentifierAllowed(targetToken.value, targetToken.line, targetToken.column);
    this.expect("eq");
    const value = this.parseExpression();
    this.skipExtraNewlines();
    return {
      type: "Assign",
      target: targetToken.value,
      value,
    };
  }

  private parseCallStatement(): PfScriptStatement {
    const calleeToken = this.advance();
    if (calleeToken.type !== "identifier") {
      throw this.error("Expected call target identifier", calleeToken);
    }
    assertIdentifierAllowed(calleeToken.value, calleeToken.line, calleeToken.column);
    const args = this.parseCallArgs();
    this.skipExtraNewlines();
    return {
      type: "CallStmt",
      callee: calleeToken.value,
      args,
    };
  }

  private parseIf(): PfScriptIf {
    this.expect("if");
    const condition = this.parseExpression();
    this.expect("then");
    this.skipExtraNewlines();
    const thenBody = this.parseBlock();

    const elseif: PfScriptIf["elseif"] = [];
    while (this.match("elseif")) {
      const elseifCondition = this.parseExpression();
      this.expect("then");
      this.skipExtraNewlines();
      elseif.push({
        condition: elseifCondition,
        body: this.parseBlock(),
      });
    }

    let elseBody: PfScriptStatement[] | undefined;
    if (this.match("else")) {
      this.skipExtraNewlines();
      elseBody = this.parseBlock();
    }

    this.expect("end");
    this.skipExtraNewlines();

    return {
      type: "If",
      condition,
      then: thenBody,
      elseif,
      else: elseBody,
    };
  }

  private parseCallArgs(): PfScriptNamedArg[] {
    this.expect("lparen");
    this.skipExtraNewlines();
    const args: PfScriptNamedArg[] = [];

    if (!this.check("rparen")) {
      do {
        this.skipExtraNewlines();
        args.push(this.parseCallArg());
        this.skipExtraNewlines();
      } while (this.match("comma"));
    }

    this.skipExtraNewlines();
    this.expect("rparen");
    return args;
  }

  private parseCallArg(): PfScriptNamedArg {
    if (this.check("identifier") && this.tokens[this.index + 1]?.type === "eq") {
      const nameToken = this.advance();
      this.expect("eq");
      return {
        name: nameToken.value,
        value: this.parseExpression(),
      };
    }

    return { value: this.parseExpression() };
  }

  private parseExpression(): PfScriptExpression {
    return this.parseOr();
  }

  private parseOr(): PfScriptExpression {
    let left = this.parseAnd();
    while (this.match("or")) {
      left = this.binary("or", left, this.parseAnd());
    }
    return left;
  }

  private parseAnd(): PfScriptExpression {
    let left = this.parseNot();
    while (this.match("and")) {
      left = this.binary("and", left, this.parseNot());
    }
    return left;
  }

  private parseNot(): PfScriptExpression {
    if (this.match("not")) {
      return {
        type: "Unary",
        op: "not",
        argument: this.parseNot(),
      };
    }
    return this.parseComparison();
  }

  private parseComparison(): PfScriptExpression {
    let left = this.parseAddition();
    while (this.isComparisonOperator(this.peek().type)) {
      const opToken = this.advance();
      const op = this.comparisonOpFromToken(opToken.type);
      left = this.binary(op, left, this.parseAddition());
    }
    return left;
  }

  private parseAddition(): PfScriptExpression {
    let left = this.parseMultiplication();
    while (this.match("plus") || this.match("minus")) {
      const op = this.previous().type === "plus" ? "+" : "-";
      left = this.binary(op, left, this.parseMultiplication());
    }
    return left;
  }

  private parseMultiplication(): PfScriptExpression {
    let left = this.parseUnary();
    while (this.match("star") || this.match("slash") || this.match("percent")) {
      const prev = this.previous().type;
      const op = prev === "star" ? "*" : prev === "slash" ? "/" : "%";
      left = this.binary(op, left, this.parseUnary());
    }
    return left;
  }

  private parseUnary(): PfScriptExpression {
    if (this.match("minus")) {
      return { type: "Unary", op: "-", argument: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): PfScriptExpression {
    const token = this.peek();

    if (token.type === "number") {
      this.advance();
      return { type: "Number", value: Number(token.value) };
    }

    if (token.type === "string") {
      this.advance();
      return { type: "String", value: token.value };
    }

    if (token.type === "true" || token.type === "false") {
      this.advance();
      return { type: "Boolean", value: token.type === "true" };
    }

    if (token.type === "identifier") {
      const nameToken = this.advance();
      assertIdentifierAllowed(nameToken.value, nameToken.line, nameToken.column);

      if (this.check("lparen")) {
        return {
          type: "Call",
          callee: nameToken.value,
          args: this.parseCallArgs(),
        };
      }

      if (this.check("dot")) {
        this.advance();
        const memberToken = this.expect("identifier");
        if (
          FORBIDDEN_IDENTIFIER_PREFIXES.includes(
            nameToken.value as (typeof FORBIDDEN_IDENTIFIER_PREFIXES)[number],
          )
        ) {
          throw new PfScriptParseError(
            `Forbidden member access: ${nameToken.value}.${memberToken.value}`,
            nameToken.line,
            nameToken.column,
          );
        }
        throw this.error("Member access is not supported", memberToken);
      }

      return { type: "Identifier", name: nameToken.value };
    }

    if (token.type === "lparen") {
      this.advance();
      const expr = this.parseExpression();
      this.expect("rparen");
      return expr;
    }

    throw this.error(`Unexpected token in expression: ${token.type}`, token);
  }

  private binary(
    op: PfScriptBinaryOp,
    left: PfScriptExpression,
    right: PfScriptExpression,
  ) {
    return { type: "Binary" as const, op, left, right };
  }

  private isStatementStart(): boolean {
    const token = this.peek();
    if (token.type === "newline" || token.type === "eof") {
      return false;
    }
    return (
      token.type === "if" || token.type === "identifier" || token.type === "forbidden"
    );
  }

  private isComparisonOperator(type: Token["type"]): boolean {
    return (
      type === "eqeq" ||
      type === "ne" ||
      type === "gt" ||
      type === "lt" ||
      type === "gte" ||
      type === "lte"
    );
  }

  private comparisonOpFromToken(type: Token["type"]): PfScriptBinaryOp {
    switch (type) {
      case "eqeq":
        return "==";
      case "ne":
        return "!=";
      case "gt":
        return ">";
      case "lt":
        return "<";
      case "gte":
        return ">=";
      case "lte":
        return "<=";
      default:
        throw new PfScriptParseError(`Invalid comparison operator: ${type}`, 1, 1);
    }
  }

  private skipExtraNewlines(): void {
    while (this.match("newline")) {
      // skip
    }
  }

  private match(type: Token["type"]): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private check(type: Token["type"]): boolean {
    return this.peek().type === type;
  }

  private expect(type: Token["type"]): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw this.error(`Expected ${type}, got ${token.type}`, token);
    }
    return this.advance();
  }

  private peek(): Token {
    const token = this.tokens[this.index];
    if (!token) {
      throw new PfScriptParseError("Unexpected end of input", 1, 1);
    }
    if (token.type === "newline") {
      this.index += 1;
      return this.peek();
    }
    return token;
  }

  private advance(): Token {
    const token = this.peek();
    this.index += 1;
    return token;
  }

  private previous(): Token {
    return this.tokens[this.index - 1] ?? this.peek();
  }

  private error(message: string, token: Token): PfScriptParseError {
    return new PfScriptParseError(message, token.line, token.column);
  }
}
