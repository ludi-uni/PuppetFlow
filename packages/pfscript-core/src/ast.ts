export type PfScriptProgram = {
  type: "Program";
  body: PfScriptStatement[];
};

export type PfScriptStatement = PfScriptAssign | PfScriptIf | PfScriptCallStmt;

export interface PfScriptAssign {
  type: "Assign";
  target: string;
  value: PfScriptExpression;
}

export interface PfScriptElseIfClause {
  condition: PfScriptExpression;
  body: PfScriptStatement[];
}

export interface PfScriptIf {
  type: "If";
  condition: PfScriptExpression;
  then: PfScriptStatement[];
  elseif: PfScriptElseIfClause[];
  else?: PfScriptStatement[];
}

export interface PfScriptCallStmt {
  type: "CallStmt";
  callee: string;
  args: PfScriptNamedArg[];
}

export interface PfScriptNamedArg {
  name?: string;
  value: PfScriptExpression;
}

export type PfScriptExpression =
  | PfScriptNumberLiteral
  | PfScriptStringLiteral
  | PfScriptBooleanLiteral
  | PfScriptIdentifier
  | PfScriptUnary
  | PfScriptBinary
  | PfScriptCallExpr;

export interface PfScriptNumberLiteral {
  type: "Number";
  value: number;
}

export interface PfScriptStringLiteral {
  type: "String";
  value: string;
}

export interface PfScriptBooleanLiteral {
  type: "Boolean";
  value: boolean;
}

export interface PfScriptIdentifier {
  type: "Identifier";
  name: string;
}

export interface PfScriptUnary {
  type: "Unary";
  op: "not" | "-";
  argument: PfScriptExpression;
}

export type PfScriptBinaryOp =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "=="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "and"
  | "or";

export interface PfScriptBinary {
  type: "Binary";
  op: PfScriptBinaryOp;
  left: PfScriptExpression;
  right: PfScriptExpression;
}

export interface PfScriptCallExpr {
  type: "Call";
  callee: string;
  args: PfScriptNamedArg[];
}
