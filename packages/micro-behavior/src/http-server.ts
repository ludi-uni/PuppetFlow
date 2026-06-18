import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import type { MicroBehaviorEngine } from "./engine.js";
import { parseBehaviorRequest } from "./parse-behavior-input.js";

export interface BehaviorHttpServerConfig {
  host?: string;
  port?: number;
  engine: MicroBehaviorEngine;
}

export interface BehaviorHttpServer {
  server: Server;
  url: string;
  close(): Promise<void>;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  return JSON.parse(raw) as unknown;
}

export function startBehaviorHttpServer(
  config: BehaviorHttpServerConfig,
): Promise<BehaviorHttpServer> {
  const host = config.host ?? "127.0.0.1";
  const port = config.port ?? 8787;
  const engine = config.engine;

  const server = createServer(async (request, response) => {
    if (!request.url || !request.method) {
      sendJson(response, 400, { error: "Invalid request" });
      return;
    }

    const url = new URL(request.url, `http://${host}:${port}`);

    if (request.method === "OPTIONS") {
      sendJson(response, 204, null);
      return;
    }

    if (request.method === "GET" && url.pathname === "/behavior/status") {
      sendJson(response, 200, engine.getStatus());
      return;
    }

    if (request.method === "GET" && url.pathname === "/behavior/queue") {
      sendJson(response, 200, engine.getQueueStatus());
      return;
    }

    if (request.method === "GET" && url.pathname === "/behavior/definitions") {
      sendJson(response, 200, { behaviors: engine.listDefinitions() });
      return;
    }

    if (request.method === "POST" && url.pathname === "/behavior") {
      try {
        const body = await readJsonBody(request);
        const parsed = parseBehaviorRequest(body);
        if (!parsed) {
          sendJson(response, 400, { error: "Invalid behavior request" });
          return;
        }

        const accepted = engine.request(parsed);
        if (!accepted) {
          sendJson(response, 404, {
            error: "Unknown behavior (provide definition for custom behaviors)",
          });
          return;
        }

        sendJson(response, 204, null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid JSON body";
        sendJson(response, 400, { error: message });
      }
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      resolve({
        server,
        url: `http://${host}:${port}`,
        close: () =>
          new Promise<void>((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }
              closeResolve();
            });
          }),
      });
    });
  });
}
