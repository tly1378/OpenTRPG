import { clients } from "../state/index.mjs";
import { broadcastStatus } from "./status.mjs";

export function syncClientIdentityForToken(token) {
  let hasChanged = false;

  for (const connectedClient of clients.values()) {
    if (connectedClient.identity.type === "player" && connectedClient.identity.id === token.id) {
      connectedClient.identity = {
        ...connectedClient.identity,
        name: token.name,
      };
      hasChanged = true;
    }
  }

  if (hasChanged) {
    broadcastStatus();
  }
}
