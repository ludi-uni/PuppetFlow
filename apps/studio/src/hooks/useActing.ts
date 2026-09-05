import type {
  ActRequest,
  ClearExpressionRequest,
  ControlResult,
  PuppetFlowCapabilities,
  PuppetFlowControlState,
  SequenceRequest,
  SetExpressionRequest,
} from "@puppetflow/control";
import {
  PuppetFlowControlClient,
  PuppetFlowControlTransportError,
} from "@puppetflow/control-client";
import { useCallback, useEffect, useState } from "react";
import type { SharedHostConfig } from "../execution-mode";
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
  hostInstanceId?: string;
  sharedEndpoint?: string;
  act: (request: ActRequest) => Promise<ControlResult | undefined>;
  sequence: (request: SequenceRequest) => Promise<ControlResult | undefined>;
  interrupt: () => Promise<ControlResult | undefined>;
  setExpression: (request: SetExpressionRequest) => Promise<ControlResult | undefined>;
  clearExpression: (
    request?: ClearExpressionRequest,
  ) => Promise<ControlResult | undefined>;
}

export interface UseActingOptions {
  sharedHost?: SharedHostConfig | null;
}

export function useActing({
  sharedHost = undefined,
}: UseActingOptions = {}): UseActingResult {
  const [state, setState] = useState<PuppetFlowControlState>(EMPTY_ACTING_STATE);
  const [capabilities, setCapabilities] =
    useState<PuppetFlowCapabilities>(EMPTY_CAPABILITIES);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [client, setClient] = useState<PuppetFlowControlClient | null>(null);
  const [hostInstanceId, setHostInstanceId] = useState<string | undefined>();
  const [connectionAttempt, setConnectionAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    if (sharedHost !== undefined) {
      if (!sharedHost) {
        setClient(null);
        setReady(false);
        setState(EMPTY_ACTING_STATE);
        setCapabilities(EMPTY_CAPABILITIES);
        setHostInstanceId(undefined);
        setStatus("Shared Host URL and token are required.");
        return;
      }
      const sharedClient = new PuppetFlowControlClient({
        baseUrl: sharedHost.baseUrl,
        token: sharedHost.token,
      });
      let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
      let connecting = false;
      const reconnect = (): void => {
        if (disposed || reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = undefined;
          void connect();
        }, 1_000);
      };
      const connect = async (): Promise<void> => {
        if (disposed || connecting) return;
        connecting = true;
        setReady(false);
        setState(EMPTY_ACTING_STATE);
        try {
          const {
            info,
            capabilities: nextCapabilities,
            snapshot,
          } = await sharedClient.connect();
          if (disposed) return;
          setClient(sharedClient);
          setHostInstanceId(info.hostInstanceId);
          setCapabilities(nextCapabilities);
          setState(snapshot.state);
          setStatus(null);
          setReady(true);
          unsubscribe?.();
          unsubscribe = sharedClient.subscribe(
            (nextSnapshot) => {
              if (!disposed) setState(nextSnapshot.state);
            },
            (error) => {
              if (disposed) return;
              unsubscribe?.();
              unsubscribe = undefined;
              setClient(null);
              setReady(false);
              setState(EMPTY_ACTING_STATE);
              setStatus(error.message);
              reconnect();
            },
          ).close;
        } catch (error) {
          if (!disposed) {
            setClient(null);
            setReady(false);
            setState(EMPTY_ACTING_STATE);
            setStatus(errorMessage(error));
            reconnect();
          }
        } finally {
          connecting = false;
        }
      };
      void connect();
      return () => {
        disposed = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        unsubscribe?.();
        sharedClient.close();
      };
    }

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
  }, [connectionAttempt, sharedHost?.baseUrl, sharedHost?.token]);

  const runCommand = useCallback(
    async (command: () => ControlResult | Promise<ControlResult>) => {
      try {
        const result = await command();
        setState(result.state);
        setStatus(
          result.accepted ? null : (result.reason ?? "Acting command was rejected"),
        );
        return result;
      } catch (error) {
        const transportError =
          error instanceof PuppetFlowControlTransportError ? error : null;
        if (transportError) {
          setClient(null);
          setReady(false);
          setState(EMPTY_ACTING_STATE);
          setCapabilities(EMPTY_CAPABILITIES);
          setHostInstanceId(undefined);
          setConnectionAttempt((attempt) => attempt + 1);
        }
        setStatus(
          transportError?.outcomeUnknown
            ? `${transportError.message} (command outcome unknown)`
            : errorMessage(error),
        );
        return undefined;
      }
    },
    [],
  );

  const act = useCallback(
    (request: ActRequest) =>
      runCommand(() =>
        sharedHost !== undefined
          ? (client?.act(request) ??
            Promise.reject(new Error("Shared Host is not connected")))
          : runtimeAct(request),
      ),
    [client, runCommand, sharedHost],
  );
  const sequence = useCallback(
    (request: SequenceRequest) =>
      runCommand(() =>
        sharedHost !== undefined
          ? (client?.sequence(request) ??
            Promise.reject(new Error("Shared Host is not connected")))
          : runtimeSequence(request),
      ),
    [client, runCommand, sharedHost],
  );
  const interrupt = useCallback(
    () =>
      runCommand(() =>
        sharedHost !== undefined
          ? (client?.interrupt() ??
            Promise.reject(new Error("Shared Host is not connected")))
          : runtimeInterrupt(),
      ),
    [client, runCommand, sharedHost],
  );
  const setExpression = useCallback(
    (request: SetExpressionRequest) =>
      runCommand(() =>
        sharedHost !== undefined
          ? (client?.setExpression(request) ??
            Promise.reject(new Error("Shared Host is not connected")))
          : runtimeSetExpression(request),
      ),
    [client, runCommand, sharedHost],
  );
  const clearExpression = useCallback(
    (request?: ClearExpressionRequest) =>
      runCommand(() =>
        sharedHost !== undefined
          ? (client?.clearExpression(request) ??
            Promise.reject(new Error("Shared Host is not connected")))
          : runtimeClearExpression(request),
      ),
    [client, runCommand, sharedHost],
  );

  return {
    state,
    capabilities,
    ready,
    status,
    hostInstanceId,
    sharedEndpoint: sharedHost?.baseUrl,
    act,
    sequence,
    interrupt,
    setExpression,
    clearExpression,
  };
}
