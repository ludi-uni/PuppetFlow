import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { createAuthenticatedAvatarSocketFactory } from "./avatar-input-websocket.js";

const closeCallbacks: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closeCallbacks.splice(0).map((close) => close()));
});

describe("authenticated Avatar input socket", () => {
  it("sends the existing internal service headers to the selected endpoint", async () => {
    const server = createServer();
    const webSocketServer = new WebSocketServer({ server });
    await listen(server);
    closeCallbacks.push(() => closeServer(server, webSocketServer));
    const requestHeaders = new Promise<{ authorization?: string; service?: string }>(
      (resolve) => {
        webSocketServer.once("connection", (_socket, request) => {
          resolve({
            authorization: request.headers.authorization,
            service: request.headers["x-internal-service"] as string | undefined,
          });
        });
      },
    );
    const port = (server.address() as AddressInfo).port;
    const socket = createAuthenticatedAvatarSocketFactory({
      service: "puppetflow-host",
      token: "avatar-test-credential",
    })(`ws://127.0.0.1:${port}/puppetflow/ws`);
    const opened = new Promise<void>((resolve) => {
      socket.onopen = () => resolve();
    });

    await opened;
    await expect(requestHeaders).resolves.toEqual({
      authorization: "Bearer avatar-test-credential",
      service: "puppetflow-host",
    });
    socket.close();
  });

  it("does not forward the credential across a redirect", async () => {
    let redirectedRequests = 0;
    const destination = createServer();
    const destinationSockets = new WebSocketServer({ server: destination });
    destinationSockets.on("connection", () => redirectedRequests++);
    await listen(destination);
    closeCallbacks.push(() => closeServer(destination, destinationSockets));

    const redirect = createServer((_request, response) => {
      response.writeHead(302, {
        Location: `ws://127.0.0.1:${(destination.address() as AddressInfo).port}/input`,
      });
      response.end();
    });
    await listen(redirect);
    closeCallbacks.push(() => closeHttpServer(redirect));
    const socket = createAuthenticatedAvatarSocketFactory({
      service: "puppetflow-host",
      token: "avatar-test-credential",
    })(`ws://127.0.0.1:${(redirect.address() as AddressInfo).port}/input`);
    const closed = new Promise<void>((resolve) => {
      socket.onerror = () => resolve();
      socket.onclose = () => resolve();
    });

    await closed;
    expect(redirectedRequests).toBe(0);
    socket.close();
  });
});

function listen(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

function closeHttpServer(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

function closeServer(
  server: ReturnType<typeof createServer>,
  sockets: WebSocketServer,
): Promise<void> {
  sockets.close();
  return closeHttpServer(server);
}
