import { WebSocket as NodeWebSocket } from "ws";
import type {
  WebSocketConnection,
  WebSocketFactory,
} from "@puppetflow/source-websocket";

export interface AvatarInputCredential {
  service: string;
  token: string;
}

export function createAuthenticatedAvatarSocketFactory(
  credential: AvatarInputCredential,
): WebSocketFactory {
  const service = credential.service.trim();
  const token = credential.token.trim();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(service)) {
    throw new Error("Avatar input service name is invalid");
  }
  if (!token || /[\r\n]/.test(token)) {
    throw new Error("Avatar input service credential is invalid");
  }

  return (url) =>
    new NodeWebSocket(url, {
      followRedirects: false,
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Internal-Service": service,
      },
    }) as unknown as WebSocketConnection;
}
