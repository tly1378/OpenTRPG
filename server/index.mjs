import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const pingIntervalMs = 2500;
const avatarOffsetLimit = 10;

const clients = new Map();
const sceneImages = [];
const sceneCharacters = [];
const sceneTokens = [];
const blockedVerticalEdges = new Set();
const blockedHorizontalEdges = new Set();
const sceneDoors = new Map();
const sceneRooms = new Map();
const chatMessages = [];
const maxChatMessages = 100;

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    });
    response.end(JSON.stringify({ ok: true, clients: clients.size }));
    return;
  }

  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

const wss = new WebSocketServer({ server });

function sendJson(socket, payload) {
  if (socket.readyState !== socket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function broadcastStatus() {
  const connectedClients = [...clients.values()].map((client) => ({
    clientId: client.clientId,
    identity: client.identity,
    latencyMs: client.latencyMs,
    connectedAt: client.connectedAt,
    lastSeenAt: client.lastSeenAt,
  }));

  for (const client of clients.values()) {
    sendJson(client.socket, {
      type: "clients",
      clients: connectedClients,
      serverTime: Date.now(),
    });
  }
}

function sceneSnapshotPayload(serverTime = Date.now()) {
  return {
    type: "scene:snapshot",
    images: sceneImages,
    characters: sceneCharacters,
    tokens: sceneTokens,
    blockedVerticalEdges: [...blockedVerticalEdges],
    blockedHorizontalEdges: [...blockedHorizontalEdges],
    doors: [...sceneDoors.values()],
    rooms: [...sceneRooms.values()],
    serverTime,
  };
}

function broadcastSceneSnapshot() {
  const payload = {
    ...sceneSnapshotPayload(),
  };

  for (const client of clients.values()) {
    sendJson(client.socket, payload);
  }
}

function chatHistoryPayload(serverTime = Date.now()) {
  return {
    type: "chat:history",
    messages: chatMessages,
    serverTime,
  };
}

function broadcastChatMessage(message) {
  const payload = {
    type: "chat:message",
    message,
    serverTime: Date.now(),
  };

  for (const client of clients.values()) {
    sendJson(client.socket, payload);
  }
}

function isFiniteCell(cell) {
  return (
    cell &&
    typeof cell === "object" &&
    Number.isFinite(cell.x) &&
    Number.isFinite(cell.y)
  );
}

function normalizeBlockedEdge(edge) {
  if (!edge || typeof edge !== "object") {
    return null;
  }

  const type = edge.type === "vertical" ? "vertical" : edge.type === "horizontal" ? "horizontal" : null;
  if (!type || !Number.isFinite(edge.x) || !Number.isFinite(edge.y)) {
    return null;
  }

  return {
    type,
    x: edge.x,
    y: edge.y,
    key: `${edge.x},${edge.y}`,
  };
}

function doorKey(door) {
  return `${door.type}:${door.x},${door.y}`;
}

function normalizeSceneDoor(door) {
  const edge = normalizeBlockedEdge(door);
  if (!edge || typeof door.isOpen !== "boolean") {
    return null;
  }

  return {
    type: edge.type,
    x: edge.x,
    y: edge.y,
    isOpen: door.isOpen,
  };
}

function normalizeSceneRoom(room) {
  if (!room || typeof room !== "object" || !Array.isArray(room.cells)) {
    return null;
  }

  const id = String(room.id ?? "");
  const name = String(room.name ?? "").trim().slice(0, 32);
  if (!id || room.cells.length === 0 || room.cells.length > 2048) {
    return null;
  }

  const cells = [];
  const seenCells = new Set();
  for (const cell of room.cells) {
    if (!isFiniteCell(cell)) {
      return null;
    }

    const key = `${cell.x},${cell.y}`;
    if (seenCells.has(key)) {
      continue;
    }

    seenCells.add(key);
    cells.push({ x: cell.x, y: cell.y });
  }

  return {
    id,
    name,
    cells,
  };
}

function blockedEdgeSet(type) {
  return type === "vertical" ? blockedVerticalEdges : blockedHorizontalEdges;
}

function normalizeImageZIndexes() {
  sceneImages
    .sort((a, b) => a.z - b.z)
    .forEach((image, index) => {
      image.z = index + 1;
    });
}

function normalizeSceneImage(image) {
  if (!image || typeof image !== "object") {
    return null;
  }

  const id = String(image.id ?? "");
  const name = String(image.name ?? "");
  const src = String(image.src ?? "");
  const numericFields = [
    image.x,
    image.y,
    image.width,
    image.height,
    image.originalWidth,
    image.originalHeight,
    image.rotation,
    image.z,
  ];

  if (
    !id ||
    !name ||
    !src.startsWith("data:image/") ||
    numericFields.some((value) => !Number.isFinite(value)) ||
    image.width <= 0 ||
    image.height <= 0 ||
    image.originalWidth <= 0 ||
    image.originalHeight <= 0
  ) {
    return null;
  }

  return {
    id,
    src,
    name,
    x: image.x,
    y: image.y,
    width: image.width,
    height: image.height,
    originalWidth: image.originalWidth,
    originalHeight: image.originalHeight,
    rotation: image.rotation,
    z: image.z,
  };
}

function upsertSceneImage(image) {
  const existingImageIndex = sceneImages.findIndex((candidate) => candidate.id === image.id);
  if (existingImageIndex === -1) {
    sceneImages.push(image);
  } else {
    sceneImages[existingImageIndex] = image;
  }
}

function clampNumber(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function normalizeTokenAvatarFields(token) {
  const avatarSrc = typeof token.avatarSrc === "string" && token.avatarSrc.startsWith("data:image/") ? token.avatarSrc : null;
  if (!avatarSrc) {
    return {};
  }

  return {
    avatarSrc,
    avatarScale: clampNumber(token.avatarScale, 1, 3, 1),
    avatarOffsetX: clampNumber(token.avatarOffsetX, -avatarOffsetLimit, avatarOffsetLimit, 0),
    avatarOffsetY: clampNumber(token.avatarOffsetY, -avatarOffsetLimit, avatarOffsetLimit, 0),
  };
}

function normalizeSceneCharacter(character) {
  if (!character || typeof character !== "object") {
    return null;
  }

  const id = String(character.id ?? "");
  const name = String(character.name ?? "");
  const color = String(character.color ?? "");

  if (!id || !name || !color) {
    return null;
  }

  return {
    id,
    name,
    color,
    ...normalizeTokenAvatarFields(character),
  };
}

function normalizeSceneToken(token) {
  if (!token || typeof token !== "object" || !isFiniteCell(token.cell)) {
    return null;
  }

  const character = normalizeSceneCharacter(token);
  if (!character) {
    return null;
  }

  return {
    ...character,
    cell: {
      x: token.cell.x,
      y: token.cell.y,
    },
  };
}

function normalizeTokenName(name) {
  const normalizedName = String(name ?? "").trim();
  return normalizedName.length > 0 ? normalizedName.slice(0, 24) : null;
}

function upsertSceneCharacter(character) {
  const existingCharacterIndex = sceneCharacters.findIndex((candidate) => candidate.id === character.id);
  if (existingCharacterIndex === -1) {
    sceneCharacters.push(character);
  } else {
    sceneCharacters[existingCharacterIndex] = character;
  }
}

function syncTokenFromCharacter(character) {
  const token = sceneTokens.find((candidate) => candidate.id === character.id);
  if (!token) {
    return;
  }

  Object.assign(token, character, { cell: token.cell });
}

function syncCharacterFromToken(token) {
  const { cell: _cell, ...character } = token;
  upsertSceneCharacter(character);
}

function normalizeDiceChatMessage(message) {
  if (!message || typeof message !== "object" || message.kind !== "dice") {
    return null;
  }

  const formula = String(message.formula ?? "").trim().slice(0, 80);
  const detail = String(message.detail ?? "").trim().slice(0, 240);
  if (!formula || !detail || !Number.isFinite(message.total)) {
    return null;
  }

  return {
    kind: "dice",
    formula,
    total: Math.trunc(message.total),
    detail,
  };
}

function normalizeMovementPath(path, fromCell, toCell) {
  if (!Array.isArray(path) || path.length < 2 || path.length > 512) {
    return null;
  }

  const cells = [];
  for (const cell of path) {
    if (!isFiniteCell(cell)) {
      return null;
    }

    cells.push({ x: cell.x, y: cell.y });
  }

  const firstCell = cells[0];
  const lastCell = cells[cells.length - 1];
  if (
    firstCell.x !== fromCell.x ||
    firstCell.y !== fromCell.y ||
    lastCell.x !== toCell.x ||
    lastCell.y !== toCell.y
  ) {
    return null;
  }

  for (let index = 1; index < cells.length; index += 1) {
    const previousCell = cells[index - 1];
    const currentCell = cells[index];
    const dx = Math.abs(currentCell.x - previousCell.x);
    const dy = Math.abs(currentCell.y - previousCell.y);

    if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) {
      return null;
    }
  }

  return cells;
}

function movementDistance(fromCell, toCell, path) {
  const normalizedPath = normalizeMovementPath(path, fromCell, toCell);
  if (normalizedPath) {
    return normalizedPath.length - 1;
  }

  return Math.max(Math.abs(toCell.x - fromCell.x), Math.abs(toCell.y - fromCell.y));
}

function pushChatMessage(chatMessage) {
  chatMessages.push(chatMessage);
  if (chatMessages.length > maxChatMessages) {
    chatMessages.splice(0, chatMessages.length - maxChatMessages);
  }

  broadcastChatMessage(chatMessage);
}

function isCellOccupied(cell, exceptTokenId) {
  return sceneTokens.some(
    (token) =>
      token.id !== exceptTokenId &&
      token.cell.x === cell.x &&
      token.cell.y === cell.y,
  );
}

function handleHello(client, message) {
  if (!message.identity || typeof message.identity !== "object") {
    return;
  }

  client.identity = {
    id: String(message.identity.id ?? client.clientId),
    name: String(message.identity.name ?? "未知用户"),
    type:
      message.identity.type === "admin"
        ? "admin"
        : message.identity.type === "lobby"
          ? "lobby"
          : "player",
  };
  client.lastSeenAt = Date.now();
  sendJson(client.socket, {
    type: "hello",
    clientId: client.clientId,
    serverTime: client.lastSeenAt,
  });
  broadcastStatus();
  sendJson(client.socket, sceneSnapshotPayload(client.lastSeenAt));
  sendJson(client.socket, chatHistoryPayload(client.lastSeenAt));
}

function handlePong(client, message) {
  if (typeof message.sentAt !== "number") {
    return;
  }

  client.latencyMs = Math.max(0, Date.now() - message.sentAt);
  client.lastSeenAt = Date.now();
  broadcastStatus();
}

function handleSceneTokenAdd(client, message) {
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

function handleSceneCharacterAdd(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const character = normalizeSceneCharacter(message.character);
  if (!character || sceneCharacters.some((candidate) => candidate.id === character.id)) {
    return;
  }

  sceneCharacters.push(character);
  client.lastSeenAt = Date.now();
  broadcastSceneSnapshot();
}

function handleSceneCharacterUpdate(client, message) {
  const incomingCharacter = message.character;
  if (!incomingCharacter || typeof incomingCharacter !== "object") {
    return;
  }

  const character = sceneCharacters.find((candidate) => candidate.id === String(incomingCharacter.id ?? ""));
  const name = normalizeTokenName(incomingCharacter.name);
  if (!character || !name || (client.identity.type !== "admin" && client.identity.id !== character.id)) {
    return;
  }

  character.name = name;
  Object.assign(character, normalizeTokenAvatarFields(incomingCharacter));
  syncTokenFromCharacter(character);
  client.lastSeenAt = Date.now();
  syncClientIdentityForToken(character);
  broadcastSceneSnapshot();
}

function handleSceneCharacterDelete(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const characterId = String(message.characterId ?? "");
  const characterIndex = sceneCharacters.findIndex((candidate) => candidate.id === characterId);
  if (characterIndex === -1) {
    return;
  }

  sceneCharacters.splice(characterIndex, 1);
  const tokenIndex = sceneTokens.findIndex((candidate) => candidate.id === characterId);
  if (tokenIndex !== -1) {
    sceneTokens.splice(tokenIndex, 1);
  }
  client.lastSeenAt = Date.now();
  broadcastSceneSnapshot();
}

function handleSceneTokenDelete(client, message) {
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

function handleSceneImageAdd(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const image = normalizeSceneImage(message.image);
  if (!image) {
    return;
  }

  upsertSceneImage(image);
  normalizeImageZIndexes();
  client.lastSeenAt = Date.now();
  broadcastSceneSnapshot();
}

function handleSceneImageUpdate(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const image = normalizeSceneImage(message.image);
  if (!image || !sceneImages.some((candidate) => candidate.id === image.id)) {
    return;
  }

  upsertSceneImage(image);
  normalizeImageZIndexes();
  client.lastSeenAt = Date.now();
  broadcastSceneSnapshot();
}

function handleSceneImagesUpdate(client, message) {
  if (client.identity.type !== "admin" || !Array.isArray(message.images)) {
    return;
  }

  let hasChanged = false;
  for (const candidate of message.images) {
    const image = normalizeSceneImage(candidate);
    if (!image || !sceneImages.some((existingImage) => existingImage.id === image.id)) {
      continue;
    }

    upsertSceneImage(image);
    hasChanged = true;
  }

  if (!hasChanged) {
    return;
  }

  normalizeImageZIndexes();
  client.lastSeenAt = Date.now();
  broadcastSceneSnapshot();
}

function canControlToken(client, token) {
  return client.identity.type === "admin" || client.identity.id === token.id;
}

function syncClientIdentityForToken(token) {
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

function handleSceneTokenMove(client, message) {
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

function handleSceneTokenUpdate(client, message) {
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

function handleBlockedEdgeSet(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const edge = normalizeBlockedEdge(message.edge);
  if (!edge || typeof message.blocked !== "boolean") {
    return;
  }

  const set = blockedEdgeSet(edge.type);
  if (message.blocked) {
    sceneDoors.delete(doorKey(edge));
    set.add(edge.key);
  } else {
    set.delete(edge.key);
  }

  client.lastSeenAt = Date.now();
  broadcastSceneSnapshot();
}

function handleBlockedEdgesClear(client) {
  if (client.identity.type !== "admin") {
    return;
  }

  blockedVerticalEdges.clear();
  blockedHorizontalEdges.clear();
  sceneDoors.clear();
  client.lastSeenAt = Date.now();
  broadcastSceneSnapshot();
}

function handleDoorSet(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const door = normalizeSceneDoor(message.door);
  if (!door) {
    return;
  }

  blockedEdgeSet(door.type).delete(`${door.x},${door.y}`);
  sceneDoors.set(doorKey(door), door);
  client.lastSeenAt = Date.now();
  broadcastSceneSnapshot();
}

function handleDoorDelete(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const edge = normalizeBlockedEdge(message.edge);
  if (!edge) {
    return;
  }

  sceneDoors.delete(doorKey(edge));
  client.lastSeenAt = Date.now();
  broadcastSceneSnapshot();
}

function handleRoomUpdate(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const room = normalizeSceneRoom(message.room);
  if (!room) {
    return;
  }

  sceneRooms.set(room.id, room);
  client.lastSeenAt = Date.now();
  broadcastSceneSnapshot();
}

function handleChatDice(client, message) {
  if (client.identity.type === "lobby") {
    return;
  }

  const diceMessage = normalizeDiceChatMessage(message.message);
  if (!diceMessage) {
    return;
  }

  const now = Date.now();
  const chatMessage = {
    id: randomUUID(),
    authorId: String(client.identity.id ?? client.clientId),
    authorName: String(client.identity.name ?? "未知用户").slice(0, 24),
    authorType: client.identity.type === "admin" ? "admin" : "player",
    createdAt: now,
    ...diceMessage,
  };

  client.lastSeenAt = now;
  pushChatMessage(chatMessage);
}

wss.on("connection", (socket) => {
  const clientId = randomUUID();
  const now = Date.now();
  const client = {
    clientId,
    socket,
    identity: {
      id: clientId,
      name: "连接中",
      type: "player",
    },
    latencyMs: null,
    connectedAt: now,
    lastSeenAt: now,
  };

  clients.set(clientId, client);
  sendJson(socket, { type: "ready", clientId, serverTime: now });
  sendJson(socket, sceneSnapshotPayload(now));
  broadcastStatus();

  socket.on("message", (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (message.type === "hello") {
      handleHello(client, message);
      return;
    }

    if (message.type === "pong") {
      handlePong(client, message);
      return;
    }

    if (message.type === "scene:token-add") {
      handleSceneTokenAdd(client, message);
      return;
    }

    if (message.type === "scene:character-add") {
      handleSceneCharacterAdd(client, message);
      return;
    }

    if (message.type === "scene:character-update") {
      handleSceneCharacterUpdate(client, message);
      return;
    }

    if (message.type === "scene:character-delete") {
      handleSceneCharacterDelete(client, message);
      return;
    }

    if (message.type === "scene:token-delete") {
      handleSceneTokenDelete(client, message);
      return;
    }

    if (message.type === "scene:image-add") {
      handleSceneImageAdd(client, message);
      return;
    }

    if (message.type === "scene:image-update") {
      handleSceneImageUpdate(client, message);
      return;
    }

    if (message.type === "scene:images-update") {
      handleSceneImagesUpdate(client, message);
      return;
    }

    if (message.type === "scene:token-move") {
      handleSceneTokenMove(client, message);
      return;
    }

    if (message.type === "scene:token-update") {
      handleSceneTokenUpdate(client, message);
      return;
    }

    if (message.type === "scene:blocked-edge-set") {
      handleBlockedEdgeSet(client, message);
      return;
    }

    if (message.type === "scene:blocked-edges-clear") {
      handleBlockedEdgesClear(client);
      return;
    }

    if (message.type === "scene:door-set") {
      handleDoorSet(client, message);
      return;
    }

    if (message.type === "scene:door-delete") {
      handleDoorDelete(client, message);
      return;
    }

    if (message.type === "scene:room-update") {
      handleRoomUpdate(client, message);
      return;
    }

    if (message.type === "chat:dice") {
      handleChatDice(client, message);
    }
  });

  socket.on("close", () => {
    clients.delete(clientId);
    broadcastStatus();
  });
});

setInterval(() => {
  const sentAt = Date.now();
  for (const client of clients.values()) {
    sendJson(client.socket, {
      type: "ping",
      sentAt,
    });
  }
}, pingIntervalMs);

server.listen(port, () => {
  console.log(`TRPG sync server listening on http://localhost:${port}`);
});
