import type {
  ActRequest,
  ClearExpressionRequest,
  ControlResult,
  PuppetFlowCapabilities,
  PuppetFlowControlState,
  SequenceRequest,
  SetExpressionRequest,
} from "@puppetflow/control";

export interface McpControlClient {
  act(request: ActRequest): Promise<ControlResult>;
  sequence(request: SequenceRequest): Promise<ControlResult>;
  interrupt(): Promise<ControlResult>;
  setExpression(request: SetExpressionRequest): Promise<ControlResult>;
  clearExpression(request?: ClearExpressionRequest): Promise<ControlResult>;
  getState(): Promise<PuppetFlowControlState>;
  getCapabilities(): Promise<PuppetFlowCapabilities>;
  close(): void;
}

export interface NormalizedExpressionState {
  current_expression: string | null;
  expression_id: number | null;
  intensity: number | null;
  duration: number | null;
  fade_in: number | null;
  fade_out: number | null;
  elapsed: number;
  remaining: number | null;
  fade_remaining: number;
}

export interface NormalizedActingState {
  busy: boolean;
  current_action: string | null;
  current_sequence: number | null;
  action_id: number | null;
  sequence_id: number | null;
  elapsed: number;
  remaining: number | null;
  queued_actions: number;
  blend_remaining: number;
  expression: NormalizedExpressionState;
}

export function normalizeState(state: PuppetFlowControlState): NormalizedActingState {
  const action = state.acting.activeAction?.action ?? null;
  const expression = state.expression.activeExpression;
  return {
    busy: action !== null && action !== "idle",
    current_action: action,
    current_sequence: state.acting.sequenceId ?? null,
    action_id: state.acting.activeActionId ?? null,
    sequence_id: state.acting.sequenceId ?? null,
    elapsed: state.acting.elapsed,
    remaining: normalizedRemaining(state.acting.remaining),
    queued_actions: state.acting.queuedActions,
    blend_remaining: state.acting.blendRemaining,
    expression: {
      current_expression: expression?.expression ?? null,
      expression_id: state.expression.activeExpressionId ?? null,
      intensity: expression?.intensity ?? null,
      duration: expression?.duration ?? null,
      fade_in: expression?.fadeIn ?? null,
      fade_out: expression?.fadeOut ?? null,
      elapsed: state.expression.elapsed,
      remaining: normalizedRemaining(state.expression.remaining),
      fade_remaining: state.expression.fadeRemaining,
    },
  };
}

function normalizedRemaining(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}
