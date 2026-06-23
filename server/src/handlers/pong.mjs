import { broadcastStatus } from "../clients/status.mjs";

export function handlePong(client, message) {
  if (typeof message.sentAt !== "number") {
    return;
  }

  client.latencyMs = Math.max(0, Date.now() - message.sentAt);
  client.lastSeenAt = Date.now();
  broadcastStatus();
}
