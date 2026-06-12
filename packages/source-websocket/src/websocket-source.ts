import { applyInputPayload } from "@puppetflow/source-core";
import type { SourceUpdateTarget, StateSource } from "@puppetflow/source-core";

export interface WebSocketSourceConfig {
  url: string;
  fieldMapping?: Record<string, string>;
}

export class WebSocketSource implements StateSource {
  readonly id = "websocket";

  private readonly url: string;
  private readonly fieldMapping: Record<string, string>;
  private socket: WebSocket | null = null;
  private pendingPayload: unknown = null;

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
        try {
          const parsed: unknown = JSON.parse(String(event.data));
          if (typeof parsed === "object" && parsed !== null && "type" in parsed) {
            const envelope = parsed as {
              type?: string;
              state?: unknown;
              payload?: unknown;
            };
            if (envelope.type === "state" && envelope.state) {
              this.pendingPayload = envelope.state;
              return;
            }
            if (envelope.payload) {
              this.pendingPayload = envelope.payload;
              return;
            }
          }

          this.pendingPayload = parsed;
        } catch {
          // Ignore malformed payloads.
        }
      };
    });
  }

  async update(target: SourceUpdateTarget): Promise<void> {
    if (!this.pendingPayload) {
      return;
    }

    applyInputPayload(target, this.pendingPayload, this.fieldMapping);
    this.pendingPayload = null;
  }

  async dispose(): Promise<void> {
    this.socket?.close();
    this.socket = null;
  }
}
