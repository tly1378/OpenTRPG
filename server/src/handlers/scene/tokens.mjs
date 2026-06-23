import { randomUUID } from "node:crypto";
import { syncClientIdentityForToken } from "../../clients/identity.mjs";
import { canControlToken } from "../../clients/permissions.mjs";
import { pushChatMessage } from "../../chat/messages.mjs";
import { isFiniteCell } from "../../lib/utils.mjs";
import { normalizeTokenAvatarFields } from "../../normalization/images.mjs";
import { movementDistance } from "../../normalization/movement.mjs";
import { normalizeSceneToken, normalizeTokenName } from "../../normalization/tokens.mjs";
import { broadcastSceneSnapshot } from "../../scene/snapshot.mjs";
import {
  isCellOccupied,
  syncCharacterFromToken,
} from "../../scene/sync.mjs";
import { sceneTokens } from "../../state/index.mjs";

export function handleSceneTokenAdd(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const token = normalizeSceneToken(message.token);
  if (!token || isCellOccupied(token.cell, token.id)) {
    return;
  }

  syncCharacterFromToken(token);
  const existingTokenIndex = sceneTokens.findIndex((candidate) => candidate.id === token.id);
  if (existingTokenIndex === -1) {
    sceneTokens.push(token);
  } else {
    sceneTokens[existingTokenIndex] = token;
  }

  broadcastSceneSnapshot();
}

export function handleSceneTokenDelete(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const tokenId = String(message.tokenId ?? "");
  const tokenIndex = sceneTokens.findIndex((candidate) => candidate.id === tokenId);
  if (tokenIndex === -1) {
    return;
  }

  sceneTokens.splice(tokenIndex, 1);
  client.lastSeenAt = Date.now();
  broadcastSceneSnapshot();
}

export function handleSceneTokenMove(client, message) {
  const token = sceneTokens.find((candidate) => candidate.id === String(message.tokenId ?? ""));
  const cell = message.cell;

  if (!token || !canControlToken(client, token) || !isFiniteCell(cell) || isCellOccupied(cell, token.id)) {
    return;
  }

  const fromCell = { ...token.cell };
  const toCell = {
    x: cell.x,
    y: cell.y,
  };
  if (fromCell.x === toCell.x && fromCell.y === toCell.y) {
    return;
  }

  token.cell = { ...toCell };

  const name = normalizeTokenName(message.name);
  if (name && token.name !== name) {
    token.name = name;
    syncCharacterFromToken(token);
    syncClientIdentityForToken(token);
  }
  Object.assign(token, normalizeTokenAvatarFields(message));
  syncCharacterFromToken(token);

  const now = Date.now();
  client.lastSeenAt = now;
  broadcastSceneSnapshot();
  pushChatMessage({
    id: randomUUID(),
    authorId: String(client.identity.id ?? client.clientId),
    authorName: String(client.identity.name ?? "未知用户").slice(0, 24),
    authorType: client.identity.type === "admin" ? "admin" : "player",
    createdAt: now,
    kind: "move",
    tokenId: token.id,
    tokenName: token.name.slice(0, 24),
    fromCell,
    toCell,
    distance: movementDistance(fromCell, toCell, message.path),
  });
}

export function handleSceneTokenUpdate(client, message) {
  const incomingToken = message.token;
  if (!incomingToken || typeof incomingToken !== "object") {
    return;
  }

  const token = sceneTokens.find((candidate) => candidate.id === String(incomingToken.id ?? ""));
  const name = normalizeTokenName(incomingToken.name);
  if (!token || !name || !canControlToken(client, token)) {
    return;
  }

  token.name = name;
  Object.assign(token, normalizeTokenAvatarFields(incomingToken));
  syncCharacterFromToken(token);
  client.lastSeenAt = Date.now();
  syncClientIdentityForToken(token);
  broadcastSceneSnapshot();
}
