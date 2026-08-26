import { applyInputPayload } from "@puppetflow/source-core";
import type {
  PollingStateSource,
  SourceUpdateTarget,
  StateSourceUpdate,
} from "@puppetflow/source-core";

export interface WebSocketSourceConfig {
  url: string;
  fieldMapping?: Record<string, string>;
}

function isObjectPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class WebSocketSource implements PollingStateSource {
  readonly id = "websocket";
  readonly pollIntervalMs = 16;

  private readonly url: string;
  private readonly fieldMapping: Readonly<Record<string, string>>;
  private socket: WebSocket | null = null;
  private pendingPayload: unknown | undefined;

  constructor(config: WebSocketSourceConfig) {
    this.url = config.url;
    this.fieldMapping = config.fieldMapping ?? {};
  }

  async initialize(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;

      socket.onopen = () => resolve();
      socket.onerror = () =>
        reject(new Error(`WebSocket connection failed: ${this.url}`));
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
              return;
            }
            if (envelope.type === "state") {
              if (isObjectPayload(envelope.state)) {
                this.pendingPayload = envelope.state;
              }
              return;
            }
          }

          const envelope = parsed as { payload?: unknown };
          if ("payload" in parsed) {
            if (isObjectPayload(envelope.payload)) {
              this.pendingPayload = envelope.payload;
            }
            return;
          }

          this.pendingPayload = parsed;
        } catch {
          // Ignore malformed payloads.
        }
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

    const payload = this.pendingPayload;
    this.pendingPayload = undefined;
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
    socket?.close();
  }
}
