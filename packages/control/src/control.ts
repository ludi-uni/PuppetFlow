import type {
  ActingActionParams,
  ActingActionRequest,
  ActingExpressionParams,
  ActingExpressionRequest,
  ActingExpressionState,
  ActingRuntimeApi,
  ActingRuntimeCapabilities,
  ActingState,
  PuppetFlowRuntime,
} from "@puppetflow/runtime";

import type {
  ActRequest,
  ControlResult,
  PuppetFlowCapabilities,
  PuppetFlowControl,
  PuppetFlowControlState,
  PuppetFlowExpressionState,
  SequenceRequest,
  SetExpressionRequest,
} from "./types.js";

const UNAVAILABLE_REASON = "PuppetFlow acting is unavailable";
const COMMAND_FAILED_REASON = "PuppetFlow acting command failed";

type RuntimeControlSource = Pick<
  PuppetFlowRuntime,
  "getActingApi" | "getActingCapabilities" | "isRunning"
>;

export function createPuppetFlowControl(
  runtime: RuntimeControlSource,
): PuppetFlowControl {
  const command = (
    invoke: (api: ActingRuntimeApi) => {
      accepted: boolean;
      state: ActingState;
      reason?: string;
    },
  ): ControlResult => {
    if (!runtime.isRunning()) {
      return unavailableResult();
    }
    const api = runtime.getActingApi();
    if (api === null) {
      return unavailableResult();
    }

    try {
      const result = invoke(api);
      return {
        accepted: result.accepted,
        state: snapshot(api, result.state),
        ...(result.reason === undefined ? {} : { reason: result.reason }),
      };
    } catch {
      return {
        accepted: false,
        state: safeSnapshot(api),
        reason: COMMAND_FAILED_REASON,
      };
    }
  };

  return {
    act(request) {
      return command((api) => api.act(request.action.trim(), actParams(request)));
    },
    sequence(request: SequenceRequest) {
      return command((api) =>
        api.sequence(request.actions.map((action) => actionRequest(action))),
      );
    },
    interrupt() {
      return command((api) => api.interrupt());
    },
    setExpression(request) {
      return command((api) =>
        api.set_expression(request.expression.trim(), expressionParams(request)),
      );
    },
    clearExpression(request = {}) {
      return command((api) => api.clear_expression({ ...request }));
    },
    getState() {
      if (!runtime.isRunning()) {
        return emptyState();
      }
      const api = runtime.getActingApi();
      return api === null ? emptyState() : safeSnapshot(api);
    },
    getCapabilities() {
      const api = runtime.getActingApi();
      if (api === null) {
        return emptyCapabilities();
      }

      let capabilities: ActingRuntimeCapabilities | null;
      try {
        capabilities = runtime.getActingCapabilities();
      } catch {
        return emptyCapabilities();
      }
      if (capabilities === null) {
        return emptyCapabilities();
      }

      return capabilitiesSnapshot(capabilities);
    },
  };
}

function actParams(request: ActRequest): ActingActionParams {
  return {
    ...(request.side === undefined ? {} : { side: request.side }),
    ...(request.intensity === undefined ? {} : { intensity: request.intensity }),
    ...(request.speed === undefined ? {} : { speed: request.speed }),
    ...(request.duration === undefined ? {} : { duration: request.duration }),
    ...(request.blendDuration === undefined
      ? {}
      : { blendDuration: request.blendDuration }),
  };
}

function actionRequest(request: ActRequest): ActingActionRequest {
  return {
    action: request.action.trim(),
    ...actParams(request),
  };
}

function expressionParams(request: SetExpressionRequest): ActingExpressionParams {
  return {
    ...(request.intensity === undefined ? {} : { intensity: request.intensity }),
    ...(request.duration === undefined ? {} : { duration: request.duration }),
    ...(request.fadeIn === undefined ? {} : { fadeIn: request.fadeIn }),
    ...(request.fadeOut === undefined ? {} : { fadeOut: request.fadeOut }),
  };
}

function snapshot(
  api: ActingRuntimeApi,
  actingState: ActingState,
): PuppetFlowControlState {
  const expressionState =
    actingState.expression ?? safeExpressionState(api.get_expression_state.bind(api));
  return {
    acting: {
      ...(actingState.activeAction === undefined
        ? {}
        : { activeAction: semanticAction(actingState.activeAction) }),
      ...(actingState.activeActionId === undefined
        ? {}
        : { activeActionId: actingState.activeActionId }),
      ...(actingState.sequenceId === undefined
        ? {}
        : { sequenceId: actingState.sequenceId }),
      elapsed: actingState.elapsed,
      remaining: actingState.remaining,
      queuedActions: actingState.queueLength,
      blendRemaining: actingState.blendRemaining,
    },
    expression: semanticExpressionState(expressionState),
  };
}

function safeSnapshot(api: ActingRuntimeApi): PuppetFlowControlState {
  try {
    return snapshot(api, api.get_state());
  } catch {
    return emptyState();
  }
}

function safeExpressionState(
  getState: () => ActingExpressionState,
): ActingExpressionState {
  try {
    return getState();
  } catch {
    return emptyExpressionState();
  }
}

function semanticAction(request: ActingActionRequest): ActRequest {
  return {
    action: request.action,
    ...(request.side === undefined ? {} : { side: request.side }),
    ...(request.intensity === undefined ? {} : { intensity: request.intensity }),
    ...(request.speed === undefined ? {} : { speed: request.speed }),
    ...(request.duration === undefined ? {} : { duration: request.duration }),
    ...(request.blendDuration === undefined
      ? {}
      : { blendDuration: request.blendDuration }),
  };
}

function semanticExpressionState(
  state: ActingExpressionState,
): PuppetFlowExpressionState {
  return {
    ...(state.activeExpression === undefined
      ? {}
      : { activeExpression: semanticExpression(state.activeExpression) }),
    ...(state.activeExpressionId === undefined
      ? {}
      : { activeExpressionId: state.activeExpressionId }),
    elapsed: state.elapsed,
    remaining: state.remaining,
    fadeRemaining: state.fadeRemaining,
  };
}

function semanticExpression(request: ActingExpressionRequest): SetExpressionRequest {
  return {
    expression: request.expression,
    ...(request.intensity === undefined ? {} : { intensity: request.intensity }),
    ...(request.duration === undefined ? {} : { duration: request.duration }),
    ...(request.fadeIn === undefined ? {} : { fadeIn: request.fadeIn }),
    ...(request.fadeOut === undefined ? {} : { fadeOut: request.fadeOut }),
  };
}

function capabilitiesSnapshot(
  capabilities: ActingRuntimeCapabilities,
): PuppetFlowCapabilities {
  return {
    acting: {
      actions: [...capabilities.actions],
      sequence: true,
      interrupt: true,
    },
    expressions: {
      names: [...capabilities.expressions],
      clear: capabilities.expressions.length > 0,
    },
  };
}

function unavailableResult(): ControlResult {
  return {
    accepted: false,
    state: emptyState(),
    reason: UNAVAILABLE_REASON,
  };
}

function emptyCapabilities(): PuppetFlowCapabilities {
  return {
    acting: { actions: [], sequence: false, interrupt: false },
    expressions: { names: [], clear: false },
  };
}

function emptyState(): PuppetFlowControlState {
  return {
    acting: {
      elapsed: 0,
      remaining: 0,
      queuedActions: 0,
      blendRemaining: 0,
    },
    expression: emptyExpressionState(),
  };
}

function emptyExpressionState(): PuppetFlowExpressionState {
  return {
    elapsed: 0,
    remaining: 0,
    fadeRemaining: 0,
  };
}
