import { clients } from "../state/index.mjs";
import { sendJson } from "../lib/send.mjs";
import { sceneSnapshotPayload } from "./sync.mjs";

export function broadcastSceneSnapshot() {
  const payload = {
    ...sceneSnapshotPayload(),
  };

  for (const client of clients.values()) {
    sendJson(client.socket, payload);
  }
}
