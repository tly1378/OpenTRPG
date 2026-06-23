import { sendJson } from "../lib/send.mjs";
import { chatHistoryPayload } from "../chat/messages.mjs";
import { broadcastStatus } from "../clients/status.mjs";
import { sendSceneSnapshot } from "../scene/broadcast.mjs";

export function handleHello(client, message) {
  if (!message.identity || typeof message.identity !== "object") {
    return;
  }

  client.identity = {
    id: String(message.identity.id ?? client.clientId),
    name: String(message.identity.name ?? "未知用户"),
    type:
      message.identity.type === "admin"
        ? "admin"
        : message.identity.type === "lobby"
          ? "lobby"
          : "player",
  };
  client.lastSeenAt = Date.now();
  sendJson(client.socket, {
    type: "hello",
    clientId: client.clientId,
    serverTime: client.lastSeenAt,
  });
  broadcastStatus();
  sendSceneSnapshot(client.socket, client.lastSeenAt);
  sendJson(client.socket, chatHistoryPayload(client.lastSeenAt, client));
}
