import type {
  ActRequest,
  ClearExpressionRequest,
  ControlResult,
  PuppetFlowCapabilities,
  PuppetFlowControlState,
  SequenceRequest,
  SetExpressionRequest,
} from "@puppetflow/control";
import { useCallback, useEffect, useState } from "react";
import {
  act as runtimeAct,
  clearExpression as runtimeClearExpression,
  ensureRuntime,
  interrupt as runtimeInterrupt,
  sequence as runtimeSequence,
  setExpression as runtimeSetExpression,
  subscribeActing,
} from "../runtime";

const EMPTY_ACTING_STATE: PuppetFlowControlState = {
  acting: { elapsed: 0, remaining: 0, queuedActions: 0, blendRemaining: 0 },
  expression: { elapsed: 0, remaining: 0, fadeRemaining: 0 },
};
const EMPTY_CAPABILITIES: PuppetFlowCapabilities = {
  acting: { actions: [], sequence: false, interrupt: false },
  expressions: { names: [], clear: false },
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface UseActingResult {
  state: PuppetFlowControlState;
  capabilities: PuppetFlowCapabilities;
  ready: boolean;
  status: string | null;
  act: (request: ActRequest) => ControlResult | undefined;
  sequence: (request: SequenceRequest) => ControlResult | undefined;
  interrupt: () => ControlResult | undefined;
  setExpression: (request: SetExpressionRequest) => ControlResult | undefined;
  clearExpression: (request?: ClearExpressionRequest) => ControlResult | undefined;
}

export function useActing(): UseActingResult {
  const [state, setState] = useState<PuppetFlowControlState>(EMPTY_ACTING_STATE);
  const [capabilities, setCapabilities] =
    useState<PuppetFlowCapabilities>(EMPTY_CAPABILITIES);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    void ensureRuntime()
      .then(() => {
        if (disposed) {
          return;
        }

        unsubscribe = subscribeActing((snapshot) => {
          if (disposed) {
            return;
          }
          setState(snapshot.state);
          setCapabilities(snapshot.capabilities);
          setReady(snapshot.ready);
        });
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setStatus(errorMessage(error));
        }
      });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);

  const runCommand = useCallback((command: () => ControlResult) => {
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
    (request: ActRequest) => runCommand(() => runtimeAct(request)),
    [runCommand],
  );
  const sequence = useCallback(
    (request: SequenceRequest) => runCommand(() => runtimeSequence(request)),
    [runCommand],
  );
  const interrupt = useCallback(() => runCommand(runtimeInterrupt), [runCommand]);
  const setExpression = useCallback(
    (request: SetExpressionRequest) => runCommand(() => runtimeSetExpression(request)),
    [runCommand],
  );
  const clearExpression = useCallback(
    (request?: ClearExpressionRequest) =>
      runCommand(() => runtimeClearExpression(request)),
    [runCommand],
  );

  return {
    state,
    capabilities,
    ready,
    status,
    act,
    sequence,
    interrupt,
    setExpression,
    clearExpression,
  };
}
