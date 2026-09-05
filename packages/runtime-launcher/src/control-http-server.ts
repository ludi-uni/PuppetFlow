import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { randomUUID } from "node:crypto";

import type {
  ActRequest,
  ClearExpressionRequest,
  PuppetFlowControl,
  SequenceRequest,
  SetExpressionRequest,
} from "@puppetflow/control";
import { CONTROL_PROTOCOL_VERSION } from "@puppetflow/control-client";

import type { PuppetFlowHost } from "./puppetflow-host.js";

const MAX_BODY_BYTES = 64 * 1024;

export interface SharedHostServiceOptions {
  host: PuppetFlowHost;
  token: string;
  port?: number;
  origins?: readonly string[];
}

export interface SharedHostService {
  readonly url: string;
  readonly hostInstanceId: string;
  start(): Promise<void>;
  close(): Promise<void>;
}

/** Owns exactly one loopback listener and the supplied Host lifecycle. */
export function createSharedHostService(
  options: SharedHostServiceOptions,
): SharedHostService {
  if (!options.token.trim()) throw new Error("PuppetFlow Control token is required");
  const port = options.port ?? 8788;
  const hostInstanceId = randomUUID();
  const origins = new Set(options.origins ?? []);
  let ready = false;
  let closed = false;
  let listening = false;
  let startPromise: Promise<void> | undefined;
  let snapshotSequence = 0;
  const server = createServer((request, response) => {
    void handle(
      request,
      response,
      options.host.control,
      options.token,
      origins,
      hostInstanceId,
      () => ready,
      () => ++snapshotSequence,
    );
  });
  const listen = () =>
    new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        listening = true;
        resolve();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen({ host: "127.0.0.1", port, exclusive: true });
    });
  return {
    url: `http://127.0.0.1:${port}`,
    hostInstanceId,
    async start(): Promise<void> {
      if (closed) throw new Error("Shared PuppetFlow Host service is closed");
      if (ready) return;
      if (!startPromise) {
        startPromise = (async () => {
          // Binding precedes runtime/output start, so a port collision cannot create a Host.
          await listen();
          try {
            await options.host.start();
            ready = true;
          } catch (error) {
            await closeServer(server);
            listening = false;
            await options.host.dispose();
            throw error;
          }
        })();
      }
      return startPromise;
    },
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      ready = false;
      if (listening) await closeServer(server);
      await options.host.dispose();
    },
  };
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  control: PuppetFlowControl,
  token: string,
  origins: Set<string>,
  hostInstanceId: string,
  isReady: () => boolean,
  nextSequence: () => number,
): Promise<void> {
  const origin = request.headers.origin;
  if (origin !== undefined && !origins.has(origin))
    return reply(response, 403, { error: "Origin is not allowed" });
  if (origin !== undefined) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, X-PuppetFlow-Host-Instance",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    response.end();
    return;
  }
  if (request.headers.authorization !== `Bearer ${token}`)
    return reply(response, 401, { error: "Unauthorized" });
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  if (request.method === "GET" && pathname === "/v1/connection")
    return reply(response, 200, {
      protocolVersion: CONTROL_PROTOCOL_VERSION,
      hostInstanceId,
      ready: isReady(),
    });
  if (!isReady())
    return reply(response, 503, { error: "PuppetFlow Host is not ready" });
  if (request.method === "GET" && pathname === "/v1/capabilities")
    return reply(response, 200, control.getCapabilities());
  if (request.method === "GET" && pathname === "/v1/state")
    return reply(response, 200, {
      protocolVersion: CONTROL_PROTOCOL_VERSION,
      hostInstanceId,
      sequence: nextSequence(),
      state: control.getState(),
    });
  if (request.method !== "POST") return reply(response, 404, { error: "Not found" });
  if (request.headers["x-puppetflow-host-instance"] !== hostInstanceId)
    return reply(response, 409, { error: "PuppetFlow Host instance changed" });
  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch (error) {
    return reply(response, 400, {
      error: error instanceof Error ? error.message : "Invalid JSON request",
    });
  }
  if (!validBody(pathname, body)) {
    return reply(response, 400, {
      error: "Request body does not match the command shape",
    });
  }
  if (pathname === "/v1/act")
    return reply(response, 200, control.act(body as unknown as ActRequest));
  if (pathname === "/v1/sequence")
    return reply(response, 200, control.sequence(body as unknown as SequenceRequest));
  if (pathname === "/v1/interrupt") return reply(response, 200, control.interrupt());
  if (pathname === "/v1/set-expression")
    return reply(
      response,
      200,
      control.setExpression(body as unknown as SetExpressionRequest),
    );
  if (pathname === "/v1/clear-expression")
    return reply(
      response,
      200,
      control.clearExpression(body as unknown as ClearExpressionRequest),
    );
  return reply(response, 404, { error: "Not found" });
}

function validBody(pathname: string, body: Record<string, unknown>): boolean {
  const finite = (value: unknown): boolean =>
    value === undefined || (typeof value === "number" && Number.isFinite(value));
  const action = (value: unknown): boolean => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const item = value as Record<string, unknown>;
    return (
      typeof item.action === "string" &&
      finite(item.intensity) &&
      finite(item.speed) &&
      finite(item.duration) &&
      finite(item.blendDuration) &&
      (item.side === undefined || ["left", "right", "both"].includes(String(item.side)))
    );
  };
  if (pathname === "/v1/act") return action(body);
  if (pathname === "/v1/sequence")
    return Array.isArray(body.actions) && body.actions.every(action);
  if (pathname === "/v1/set-expression")
    return (
      typeof body.expression === "string" &&
      finite(body.intensity) &&
      finite(body.duration) &&
      finite(body.fadeIn) &&
      finite(body.fadeOut)
    );
  if (pathname === "/v1/clear-expression") return finite(body.fadeOut);
  return pathname === "/v1/interrupt";
}

function readJsonObject(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        request.destroy();
        reject(new Error("Request body exceeds 64KiB"));
      } else chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!value || Array.isArray(value) || typeof value !== "object")
          throw new Error("Request body must be a JSON object");
        resolve(value as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}
function reply(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}
function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
