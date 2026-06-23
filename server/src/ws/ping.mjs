import { pingIntervalMs } from "../config.mjs";
import { sendJson } from "../lib/send.mjs";
import { clients } from "../state/index.mjs";

export function startPingInterval() {
  setInterval(() => {
    const sentAt = Date.now();
    for (const client of clients.values()) {
      sendJson(client.socket, {
        type: "ping",
        sentAt,
      });
    }
  }, pingIntervalMs);
}
