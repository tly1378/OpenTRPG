import { NetworkClient, type SceneSnapshot } from "./networkClient";
import type { ChatPanelController, LatencyPanelController } from "../controllers/panels";

export function createNetworkSyncAdapter(options: {
  latencyPanel: LatencyPanelController;
  chatPanel: ChatPanelController;
  applySceneSnapshot: (snapshot: SceneSnapshot) => void;
}): NetworkClient {
  return new NetworkClient(
    (snapshot) => options.latencyPanel.applySnapshot(snapshot),
    options.applySceneSnapshot,
    (messages, mode) => options.chatPanel.applyMessages(messages, mode),
  );
}
