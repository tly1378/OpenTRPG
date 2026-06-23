import { randomUUID } from "node:crypto";
import { canControlToken } from "../../clients/permissions.mjs";
import { pushChatMessage } from "../../chat/messages.mjs";
import { normalizeDiceChatMessage } from "../../normalization/dice.mjs";
import { sceneTokens } from "../../state/index.mjs";

export function handleChatDice(client, message) {
  if (client.identity.type === "lobby") {
    return;
  }

  const diceMessage = normalizeDiceChatMessage(message.message);
  if (!diceMessage) {
    return;
  }

  if (client.identity.type === "admin" && !diceMessage.tokenId) {
    diceMessage.rollVisibility = diceMessage.rollVisibility === "public" ? "public" : "hidden";
  } else {
    diceMessage.rollVisibility = null;
  }

  const authorId = String(client.identity.id ?? client.clientId);
  let tokenName = null;

  if (diceMessage.tokenId) {
    const token = sceneTokens.find((candidate) => candidate.id === diceMessage.tokenId);
    if (!token || !canControlToken(client, token)) {
      return;
    }

    if (authorId !== diceMessage.tokenId) {
      tokenName = token.name.slice(0, 24);
    }
  }

  const now = Date.now();
  const chatMessage = {
    id: randomUUID(),
    authorId,
    authorName: String(client.identity.name ?? "未知用户").slice(0, 24),
    authorType: client.identity.type === "admin" ? "admin" : "player",
    createdAt: now,
    ...diceMessage,
    ...(tokenName ? { tokenName } : {}),
  };

  client.lastSeenAt = now;
  pushChatMessage(chatMessage);
}
