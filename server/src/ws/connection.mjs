import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { sendJson } from "../lib/send.mjs";
import { broadcastStatus } from "../clients/status.mjs";
import { sceneSnapshotPayload } from "../scene/sync.mjs";
import { clients } from "../state/index.mjs";
import { routeMessage } from "./router.mjs";

export function attachWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (socket) => {
    const clientId = randomUUID();
    const now = Date.now();
    const client = {
      clientId,
      socket,
      identity: {
        id: clientId,
        name: "连接中",
        type: "player",
      },
      latencyMs: null,
      connectedAt: now,
      lastSeenAt: now,
    };

    clients.set(clientId, client);
    sendJson(socket, { type: "ready", clientId, serverTime: now });
    sendJson(socket, sceneSnapshotPayload(now));
    broadcastStatus();

    socket.on("message", (data) => {
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch {
        return;
      }

      routeMessage(client, message);
    });

    socket.on("close", () => {
      clients.delete(clientId);
      broadcastStatus();
    });
  });

  return wss;
}
