import { clients } from "../state/index.mjs";
import { sendJson } from "../lib/send.mjs";

export function broadcastStatus() {
  const connectedClients = [...clients.values()].map((client) => ({
    clientId: client.clientId,
    identity: client.identity,
    latencyMs: client.latencyMs,
    connectedAt: client.connectedAt,
    lastSeenAt: client.lastSeenAt,
  }));

  for (const client of clients.values()) {
    sendJson(client.socket, {
      type: "clients",
      clients: connectedClients,
      serverTime: Date.now(),
    });
  }
}
