export type BehaviorExpression =
  | BehaviorNumberExpr
  | BehaviorStringExpr
  | BehaviorBooleanExpr
  | BehaviorIdentifierExpr
  | BehaviorUnaryExpr
  | BehaviorBinaryExpr
  | BehaviorCallExpr;

export interface BehaviorNumberExpr {
  type: "Number";
  value: number;
}

export interface BehaviorStringExpr {
  type: "String";
  value: string;
}

export interface BehaviorBooleanExpr {
  type: "Boolean";
  value: boolean;
}

export interface BehaviorIdentifierExpr {
  type: "Identifier";
  name: string;
}

export interface BehaviorUnaryExpr {
  type: "Unary";
  op: "not" | "-";
  argument: BehaviorExpression;
}

export interface BehaviorBinaryExpr {
  type: "Binary";
  op: string;
  left: BehaviorExpression;
  right: BehaviorExpression;
}

export interface BehaviorNamedArgExpr {
  name?: string;
  value: BehaviorExpression;
}

export interface BehaviorCallExpr {
  type: "Call";
  callee: string;
  args: BehaviorNamedArgExpr[];
}
