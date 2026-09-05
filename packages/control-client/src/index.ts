import type {
  ActRequest,
  ClearExpressionRequest,
  ControlResult,
  PuppetFlowCapabilities,
  PuppetFlowControlState,
  SequenceRequest,
  SetExpressionRequest,
} from "@puppetflow/control";

export const CONTROL_PROTOCOL_VERSION = 1;

export interface ControlConnectionInfo {
  protocolVersion: number;
  hostInstanceId: string;
  ready: boolean;
}

export interface ControlSnapshot {
  protocolVersion: number;
  hostInstanceId: string;
  sequence: number;
  state: PuppetFlowControlState;
}

export interface PuppetFlowControlClientOptions {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface ControlSubscription {
  close(): void;
}

export class PuppetFlowControlTransportError extends Error {
  readonly outcomeUnknown: boolean;
  constructor(message: string, outcomeUnknown = false) {
    super(message);
    this.name = "PuppetFlowControlTransportError";
    this.outcomeUnknown = outcomeUnknown;
  }
}

/** Browser-safe asynchronous adapter for the shared Host's canonical Control. */
export class PuppetFlowControlClient {
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private hostInstanceId: string | undefined;
  private generation = 0;
  private closed = false;
  private readonly requests = new Set<AbortController>();
  private queue = Promise.resolve();

  constructor(private readonly options: PuppetFlowControlClientOptions) {
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  async connect(): Promise<{
    info: ControlConnectionInfo;
    capabilities: PuppetFlowCapabilities;
    snapshot: ControlSnapshot;
  }> {
    const info = await this.request<ControlConnectionInfo>("GET", "/v1/connection");
    if (info.protocolVersion !== CONTROL_PROTOCOL_VERSION)
      throw new PuppetFlowControlTransportError(
        "Unsupported PuppetFlow Control protocol version",
      );
    if (!info.ready || !info.hostInstanceId)
      throw new PuppetFlowControlTransportError("PuppetFlow Host is not ready");
    this.closed = false;
    this.generation++;
    this.hostInstanceId = info.hostInstanceId;
    const [capabilities, snapshot] = await Promise.all([
      this.getCapabilities(),
      this.getSnapshot(),
    ]);
    return { info, capabilities, snapshot };
  }

  async getCapabilities(): Promise<PuppetFlowCapabilities> {
    return this.request("GET", "/v1/capabilities");
  }
  async getSnapshot(): Promise<ControlSnapshot> {
    const snapshot = await this.request<ControlSnapshot>("GET", "/v1/state");
    if (
      snapshot.protocolVersion !== CONTROL_PROTOCOL_VERSION ||
      (this.hostInstanceId !== undefined &&
        snapshot.hostInstanceId !== this.hostInstanceId)
    ) {
      throw new PuppetFlowControlTransportError("PuppetFlow Host instance changed");
    }
    return snapshot;
  }
  act(request: ActRequest): Promise<ControlResult> {
    return this.command("/v1/act", request);
  }
  sequence(request: SequenceRequest): Promise<ControlResult> {
    return this.command("/v1/sequence", request);
  }
  interrupt(): Promise<ControlResult> {
    return this.command("/v1/interrupt", {});
  }
  setExpression(request: SetExpressionRequest): Promise<ControlResult> {
    return this.command("/v1/set-expression", request);
  }
  clearExpression(request: ClearExpressionRequest = {}): Promise<ControlResult> {
    return this.command("/v1/clear-expression", request);
  }

  close(): void {
    this.closed = true;
    this.generation++;
    this.hostInstanceId = undefined;
    for (const request of this.requests) request.abort();
    this.requests.clear();
  }

  /** Snapshot observation only: one 5Hz, single-flight loop per subscription. */
  subscribe(
    onSnapshot: (snapshot: ControlSnapshot) => void,
    onError?: (error: PuppetFlowControlTransportError) => void,
  ): ControlSubscription {
    let closed = false;
    let inFlight = false;
    let generation = 0;
    let lastSequence = -1;
    const poll = async (): Promise<void> => {
      if (closed || inFlight) return;
      inFlight = true;
      const requestGeneration = ++generation;
      try {
        const snapshot = await this.getSnapshot();
        if (
          !closed &&
          requestGeneration === generation &&
          snapshot.sequence > lastSequence
        ) {
          lastSequence = snapshot.sequence;
          onSnapshot(snapshot);
        }
      } catch (error) {
        if (!closed && error instanceof PuppetFlowControlTransportError)
          onError?.(error);
      } finally {
        inFlight = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 200);
    return {
      close: () => {
        closed = true;
        generation++;
        clearInterval(timer);
      },
    };
  }

  private command(path: string, body: unknown): Promise<ControlResult> {
    const expectedHost = this.hostInstanceId;
    const expectedGeneration = this.generation;
    const operation = this.queue.then(async () => {
      if (
        this.closed ||
        !expectedHost ||
        expectedHost !== this.hostInstanceId ||
        expectedGeneration !== this.generation
      ) {
        throw new PuppetFlowControlTransportError(
          "PuppetFlow Host connection changed before command dispatch",
        );
      }
      let result: ControlResult;
      try {
        result = await this.request<ControlResult>(
          "POST",
          path,
          body,
          true,
          expectedHost,
        );
      } catch (error) {
        this.generation++;
        throw error;
      }
      if (
        expectedHost !== this.hostInstanceId ||
        expectedGeneration !== this.generation
      ) {
        throw new PuppetFlowControlTransportError(
          "PuppetFlow Host changed before command response",
          true,
        );
      }
      return result;
    });
    this.queue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    outcomeUnknown = false,
    expectedHostInstanceId?: string,
  ): Promise<T> {
    if (this.closed)
      throw new PuppetFlowControlTransportError("PuppetFlow Control client is closed");
    const controller = new AbortController();
    this.requests.add(controller);
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchFn(
        `${this.options.baseUrl.replace(/\/$/, "")}${path}`,
        {
          method,
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${this.options.token}`,
            ...(expectedHostInstanceId && method === "POST"
              ? { "X-PuppetFlow-Host-Instance": expectedHostInstanceId }
              : {}),
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
      );
      const payload: unknown = await response.json().catch(() => undefined);
      if (!response.ok)
        throw new PuppetFlowControlTransportError(
          typeof (payload as { error?: unknown })?.error === "string"
            ? (payload as { error: string }).error
            : `PuppetFlow Host request failed (${response.status})`,
          outcomeUnknown && response.status >= 500,
        );
      return payload as T;
    } catch (error) {
      if (error instanceof PuppetFlowControlTransportError) throw error;
      throw new PuppetFlowControlTransportError(
        error instanceof Error && error.name === "AbortError"
          ? "PuppetFlow Host request timed out"
          : "PuppetFlow Host connection failed",
        outcomeUnknown,
      );
    } finally {
      clearTimeout(timer);
      this.requests.delete(controller);
    }
  }
}
