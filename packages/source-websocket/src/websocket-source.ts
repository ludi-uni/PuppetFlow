import { applyInputPayload } from "@puppetflow/source-core";
import type {
  PollingStateSource,
  SourceUpdateTarget,
  StateSourceUpdate,
} from "@puppetflow/source-core";

export interface WebSocketSourceConfig {
  url: string;
  fieldMapping?: Record<string, string>;
  readyOnFirstPayload?: boolean;
  socketFactory?: WebSocketFactory;
  onConnectionError?: (error: Error) => void;
}

export interface WebSocketConnection {
  onopen: (() => void) | null;
  onerror: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code?: number }) => void) | null;
  close(): void;
}

export type WebSocketFactory = (url: string) => WebSocketConnection;

function isObjectPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface PendingWebSocketInitialization {
  socket: WebSocketConnection;
  resolve: () => void;
  reject: (error: unknown) => void;
}

export class WebSocketSource implements PollingStateSource {
  readonly id = "websocket";
  readonly pollIntervalMs = 16;

  private readonly url: string;
  private readonly fieldMapping: Readonly<Record<string, string>>;
  private readonly readyOnFirstPayload: boolean;
  private readonly socketFactory: WebSocketFactory;
  private readonly onConnectionError: ((error: Error) => void) | undefined;
  private socket: WebSocketConnection | null = null;
  private pendingPayload: unknown | undefined;
  private connectionError: Error | undefined;
  private lastReportedConnectionError: string | undefined;
  private pendingInitialization: PendingWebSocketInitialization | null = null;

  constructor(config: WebSocketSourceConfig) {
    this.url = config.url;
    this.fieldMapping = config.fieldMapping ?? {};
    this.readyOnFirstPayload = config.readyOnFirstPayload ?? false;
    this.socketFactory =
      config.socketFactory ?? ((url) => new WebSocket(url) as WebSocketConnection);
    this.onConnectionError = config.onConnectionError;
  }

  async initialize(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = this.socketFactory(this.url);
      this.socket = socket;
      this.connectionError = undefined;
      this.pendingInitialization = { socket, resolve, reject };

      socket.onopen = () => {
        if (this.socket !== socket) {
          return;
        }

        if (!this.readyOnFirstPayload) this.resolveInitialization(socket);
      };
      socket.onerror = () => {
        if (this.socket !== socket) {
          return;
        }

        const error = new Error(`WebSocket connection failed: ${this.url}`);
        this.connectionError = error;
        this.rejectInitialization(socket, error);
      };
      socket.onmessage = (event) => {
        if (this.socket !== socket) {
          return;
        }

        try {
          const parsed: unknown = JSON.parse(String(event.data));
          if (!isObjectPayload(parsed)) {
            return;
          }

          if ("type" in parsed) {
            const envelope = parsed as {
              type?: string;
              state?: unknown;
              payload?: unknown;
              behavior?: unknown;
            };
            if (envelope.type === "behavior") {
              this.pendingPayload = parsed;
              this.lastReportedConnectionError = undefined;
              this.resolveInitialization(socket);
              return;
            }
            if (envelope.type === "state") {
              if (isObjectPayload(envelope.state)) {
                this.pendingPayload = envelope.state;
                this.lastReportedConnectionError = undefined;
                this.resolveInitialization(socket);
              }
              return;
            }
          }

          const envelope = parsed as { payload?: unknown };
          if ("payload" in parsed) {
            if (isObjectPayload(envelope.payload)) {
              this.pendingPayload = envelope.payload;
              this.lastReportedConnectionError = undefined;
              this.resolveInitialization(socket);
            }
            return;
          }

          this.pendingPayload = parsed;
          this.lastReportedConnectionError = undefined;
          this.resolveInitialization(socket);
        } catch {
          // Ignore malformed payloads.
        }
      };
      socket.onclose = (event) => {
        if (this.socket !== socket) return;
        const error = new Error(
          this.pendingInitialization?.socket === socket
            ? `WebSocket closed before an input payload was received (${event.code ?? 0})`
            : `WebSocket connection closed (${event.code ?? 0})`,
        );
        this.connectionError = error;
        this.reportConnectionError(error);
        this.rejectInitialization(socket, error);
      };
    });
  }

  async update(target: SourceUpdateTarget): Promise<void> {
    const update = await this.poll(new AbortController().signal);
    if (!update) {
      return;
    }

    this.apply(update, target);
  }

  async poll(signal: AbortSignal): Promise<StateSourceUpdate | undefined> {
    if (signal.aborted) {
      return undefined;
    }
    if (this.connectionError) throw this.connectionError;

    const payload = this.pendingPayload;
    this.pendingPayload = undefined;
    this.connectionError = undefined;
    if (payload === undefined) {
      return undefined;
    }

    return { payload, fieldMapping: this.fieldMapping };
  }

  apply(update: StateSourceUpdate, target: SourceUpdateTarget): void {
    applyInputPayload(target, update.payload, update.fieldMapping ?? this.fieldMapping);
  }

  async dispose(): Promise<void> {
    const socket = this.socket;
    this.socket = null;
    this.pendingPayload = undefined;
    this.resolveInitialization(socket);
    socket?.close();
  }

  private resolveInitialization(socket: WebSocketConnection | null): void {
    const pending = this.pendingInitialization;
    if (!socket || pending?.socket !== socket) {
      return;
    }

    this.pendingInitialization = null;
    pending.resolve();
  }

  private rejectInitialization(socket: WebSocketConnection, error: unknown): void {
    const pending = this.pendingInitialization;
    if (pending?.socket !== socket) {
      return;
    }

    this.pendingInitialization = null;
    pending.reject(error);
  }

  private reportConnectionError(error: Error): void {
    if (this.lastReportedConnectionError === error.message) return;
    this.lastReportedConnectionError = error.message;
    try {
      this.onConnectionError?.(error);
    } catch {
      // Diagnostics must not change source availability or reconnect behavior.
    }
  }
}
