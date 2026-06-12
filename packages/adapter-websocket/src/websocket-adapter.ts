import type { Adapter } from "@puppetflow/adapter-core";
import type { MotionState } from "@puppetflow/core";

export interface WebSocketAdapterConfig {
  port?: number;
  host?: string;
}

type WsServer = {
  clients: Set<{ send(data: string): void; readyState: number }>;
  close(): void;
};

const WS_OPEN = 1;

export class WebSocketAdapter implements Adapter {
  readonly id = "websocket";

  private readonly port: number;
  private readonly host: string;
  private server: WsServer | null = null;

  constructor(config: WebSocketAdapterConfig = {}) {
    this.port = config.port ?? 3939;
    this.host = config.host ?? "127.0.0.1";
  }

  async initialize(): Promise<void> {
    const { WebSocketServer } = await import("ws");
    const server = new WebSocketServer({ host: this.host, port: this.port });
    this.server = server;
  }

  async update(motion: MotionState, deltaTime: number): Promise<void> {
    if (!this.server) {
      return;
    }

    const payload = JSON.stringify({
      type: "motion",
      motion,
      deltaTime,
      timestamp: Date.now(),
    });

    for (const client of this.server.clients) {
      if (client.readyState === WS_OPEN) {
        client.send(payload);
      }
    }
  }

  async dispose(): Promise<void> {
    this.server?.close();
    this.server = null;
  }
}
