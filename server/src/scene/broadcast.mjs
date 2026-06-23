import { clients } from "../state/index.mjs";
import { sendJson } from "../lib/send.mjs";
import { sceneSnapshotPayload } from "./sync.mjs";

export function broadcastScenePatch(patch) {
  sendJsonToAll({
    type: "scene:patch",
    serverTime: Date.now(),
    ...patch,
  });
}

export function sendSceneSnapshot(socket, serverTime = Date.now()) {
  sendJson(socket, sceneSnapshotPayload(serverTime));
}

function sendJsonToAll(payload) {
  for (const client of clients.values()) {
    sendJson(client.socket, payload);
  }
}
