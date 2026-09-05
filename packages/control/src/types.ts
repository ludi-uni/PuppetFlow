export type ActingSide = "left" | "right" | "both";

export interface ActRequest {
  action: string;
  side?: ActingSide;
  intensity?: number;
  speed?: number;
  duration?: number;
  blendDuration?: number;
}

export interface SequenceRequest {
  actions: readonly ActRequest[];
}

export interface SetExpressionRequest {
  expression: string;
  intensity?: number;
  duration?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface ClearExpressionRequest {
  fadeOut?: number;
}

export interface PuppetFlowActingState {
  activeAction?: ActRequest;
  activeActionId?: number;
  sequenceId?: number;
  elapsed: number;
  remaining: number;
  queuedActions: number;
  blendRemaining: number;
}

export interface PuppetFlowExpressionState {
  activeExpression?: SetExpressionRequest;
  activeExpressionId?: number;
  elapsed: number;
  remaining: number;
  fadeRemaining: number;
}

export interface PuppetFlowControlState {
  acting: PuppetFlowActingState;
  expression: PuppetFlowExpressionState;
}

export interface ControlResult<TState = PuppetFlowControlState> {
  accepted: boolean;
  state: TState;
  reason?: string;
}

export interface PuppetFlowCapabilities {
  acting: {
    actions: readonly string[];
    sequence: boolean;
    interrupt: boolean;
  };
  expressions: {
    names: readonly string[];
    clear: boolean;
  };
}

export interface PuppetFlowControl {
  act(request: ActRequest): ControlResult;
  sequence(request: SequenceRequest): ControlResult;
  interrupt(): ControlResult;
  setExpression(request: SetExpressionRequest): ControlResult;
  clearExpression(request?: ClearExpressionRequest): ControlResult;
  getState(): PuppetFlowControlState;
  getCapabilities(): PuppetFlowCapabilities;
}
