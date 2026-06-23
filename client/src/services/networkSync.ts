import { NetworkClient, type SceneSnapshot } from "./networkClient";
import type { ChatPanelController, LatencyPanelController } from "../controllers/panels";
import type { DiceRollDisplayController } from "../controllers/diceRollDisplayController";

export function createNetworkSyncAdapter(options: {
  latencyPanel: LatencyPanelController;
  chatPanel: ChatPanelController;
  diceRollDisplay: DiceRollDisplayController;
  applySceneSnapshot: (snapshot: SceneSnapshot) => void;
}): NetworkClient {
  return new NetworkClient(
    (snapshot) => options.latencyPanel.applySnapshot(snapshot),
    options.applySceneSnapshot,
    (messages, mode) => {
      options.chatPanel.applyMessages(messages, mode);
      options.diceRollDisplay.applyMessages(messages, mode);
    },
  );
}
