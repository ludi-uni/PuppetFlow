import type {
  ActingActionName,
  ActingActionParams,
  ActingActionRequest,
  ActingCommandResult,
  ActingState,
} from "@puppetflow/runtime";
import { useCallback, useEffect, useState } from "react";
import {
  act as runtimeAct,
  getActingState,
  interrupt as runtimeInterrupt,
  sequence as runtimeSequence,
  subscribeActing,
} from "../runtime";

const EMPTY_ACTING_STATE: ActingState = {
  elapsed: 0,
  remaining: 0,
  queueLength: 0,
  blendRemaining: 0,
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface UseActingResult {
  state: ActingState;
  status: string | null;
  act: (
    action: ActingActionName | string,
    params?: ActingActionParams,
  ) => ActingCommandResult | undefined;
  sequence: (
    actions: readonly ActingActionRequest[],
  ) => ActingCommandResult | undefined;
  interrupt: () => ActingCommandResult | undefined;
}

export function useActing(): UseActingResult {
  const [state, setState] = useState<ActingState>(EMPTY_ACTING_STATE);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    try {
      setState(getActingState());
      return subscribeActing((nextState) => {
        setState(nextState);
        setStatus(null);
      });
    } catch (error) {
      setStatus(errorMessage(error));
      return undefined;
    }
  }, []);

  const runCommand = useCallback((command: () => ActingCommandResult) => {
    try {
      const result = command();
      setState(result.state);
      setStatus(
        result.accepted ? null : (result.reason ?? "Acting command was rejected"),
      );
      return result;
    } catch (error) {
      setStatus(errorMessage(error));
      return undefined;
    }
  }, []);

  const act = useCallback(
    (action: ActingActionName | string, params?: ActingActionParams) =>
      runCommand(() => runtimeAct(action, params)),
    [runCommand],
  );
  const sequence = useCallback(
    (actions: readonly ActingActionRequest[]) =>
      runCommand(() => runtimeSequence(actions)),
    [runCommand],
  );
  const interrupt = useCallback(() => runCommand(runtimeInterrupt), [runCommand]);

  return { state, status, act, sequence, interrupt };
}
