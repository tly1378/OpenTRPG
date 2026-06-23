import { maxChatMessages } from "../config.mjs";
import { chatMessages, clients } from "../state/index.mjs";
import { sendJson } from "../lib/send.mjs";

export function canClientSeeChatMessage(client, message) {
  if (
    message.kind === "dice" &&
    message.authorType === "admin" &&
    !message.tokenId &&
    message.rollVisibility !== "public"
  ) {
    return client.identity.type === "admin";
  }

  return true;
}

export function chatHistoryPayload(serverTime = Date.now(), client = null) {
  const messages =
    client === null
      ? chatMessages
      : chatMessages.filter((message) => canClientSeeChatMessage(client, message));

  return {
    type: "chat:history",
    messages,
    serverTime,
  };
}

export function broadcastChatMessage(message) {
  const payload = {
    type: "chat:message",
    message,
    serverTime: Date.now(),
  };

  for (const client of clients.values()) {
    if (canClientSeeChatMessage(client, message)) {
      sendJson(client.socket, payload);
    }
  }
}

export function pushChatMessage(chatMessage) {
  chatMessages.push(chatMessage);
  if (chatMessages.length > maxChatMessages) {
    chatMessages.splice(0, chatMessages.length - maxChatMessages);
  }

  broadcastChatMessage(chatMessage);
}
