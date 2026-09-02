import type { PuppetFlowRuntime } from "../runtime.js";
import type { ActingCommandResult } from "./types.js";

declare const runtime: PuppetFlowRuntime;

const api = runtime.getActingApi();
if (api !== null) {
  const result = api.set_expression("happy");
  const aggregate: ActingCommandResult = result;

  void aggregate.state.expression;
  void result.state.expression;
}
