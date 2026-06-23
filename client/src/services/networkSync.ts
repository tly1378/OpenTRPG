import { NetworkClient, type ScenePatch, type SceneSnapshot } from "./networkClient";
import type { ChatPanelController, LatencyPanelController } from "../controllers/panels";
import type { DiceRollDisplayController } from "../controllers/diceRollDisplayController";

export function createNetworkSyncAdapter(options: {
  latencyPanel: LatencyPanelController;
  chatPanel: ChatPanelController;
  diceRollDisplay: DiceRollDisplayController;
  sceneSync: {
    applySnapshot: (snapshot: SceneSnapshot) => void;
    applyPatch: (patch: ScenePatch) => void;
  };
}): NetworkClient {
  return new NetworkClient(
    (snapshot) => options.latencyPanel.applySnapshot(snapshot),
    options.sceneSync.applySnapshot,
    options.sceneSync.applyPatch,
    (messages, mode) => {
      options.chatPanel.applyMessages(messages, mode);
      options.diceRollDisplay.applyMessages(messages, mode);
    },
  );
}
