import type {
  ActingActionName,
  ActingActionParams,
  ActingActionRequest,
  ActingCommandResult,
  ActingExpressionName,
  ActingExpressionParams,
  ActingExpressionState,
  ActingRuntimeApi,
  ActingState,
} from "./acting/index.js";
import type { PuppetFlowRuntime } from "./runtime.js";

/**
 * Transport-independent access to the Runtime-owned ActingEngine.
 * @deprecated Use `PuppetFlowControl` from `@puppetflow/control`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- this named interface is the public Control boundary.
export interface PuppetFlowControl extends ActingRuntimeApi {}

/** @deprecated Use `createPuppetFlowControl` from `@puppetflow/control`. */
export function createPuppetFlowControl(runtime: PuppetFlowRuntime): PuppetFlowControl {
  function actingApi(): ActingRuntimeApi {
    const api = runtime.getActingApi();
    if (api === null) {
      throw new Error("PuppetFlow Acting API is unavailable");
    }
    if (!runtime.isRunning()) {
      throw new Error("PuppetFlow Runtime is not running");
    }
    return api;
  }

  return {
    act(
      action: ActingActionName | string,
      params?: ActingActionParams,
    ): ActingCommandResult {
      return actingApi().act(action, params);
    },
    sequence(actions: readonly ActingActionRequest[]): ActingCommandResult {
      return actingApi().sequence(actions);
    },
    interrupt(): ActingCommandResult {
      return actingApi().interrupt();
    },
    get_state(): ActingState {
      return actingApi().get_state();
    },
    set_expression(
      expression: ActingExpressionName | string,
      params?: ActingExpressionParams,
    ): ActingCommandResult {
      return actingApi().set_expression(expression, params);
    },
    clear_expression(params?: { fadeOut?: number }): ActingCommandResult {
      return actingApi().clear_expression(params);
    },
    get_expression_state(): ActingExpressionState {
      return actingApi().get_expression_state();
    },
  };
}
