import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const pingIntervalMs = 2500;

const clients = new Map();
const sceneTokens = [];
const blockedVerticalEdges = new Set();
const blockedHorizontalEdges = new Set();

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
    tokens: sceneTokens,
    blockedVerticalEdges: [...blockedVerticalEdges],
    blockedHorizontalEdges: [...blockedHorizontalEdges],
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

function blockedEdgeSet(type) {
  return type === "vertical" ? blockedVerticalEdges : blockedHorizontalEdges;
}

function normalizeSceneToken(token) {
  if (!token || typeof token !== "object" || !isFiniteCell(token.cell)) {
    return null;
  }

  const id = String(token.id ?? "");
  const name = String(token.name ?? "");
  const color = String(token.color ?? "");

  if (!id || !name || !color) {
    return null;
  }

  return {
    id,
    name,
    color,
    cell: {
      x: token.cell.x,
      y: token.cell.y,
    },
  };
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

  const existingTokenIndex = sceneTokens.findIndex((candidate) => candidate.id === token.id);
  if (existingTokenIndex === -1) {
    sceneTokens.push(token);
  } else {
    sceneTokens[existingTokenIndex] = token;
  }

  broadcastSceneSnapshot();
}

function canControlToken(client, token) {
  return client.identity.type === "admin" || client.identity.id === token.id;
}

function handleSceneTokenMove(client, message) {
  const token = sceneTokens.find((candidate) => candidate.id === String(message.tokenId ?? ""));
  const cell = message.cell;

  if (!token || !canControlToken(client, token) || !isFiniteCell(cell) || isCellOccupied(cell, token.id)) {
    return;
  }

  token.cell = {
    x: cell.x,
    y: cell.y,
  };
  client.lastSeenAt = Date.now();
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
  client.lastSeenAt = Date.now();
  broadcastSceneSnapshot();
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

    if (message.type === "scene:token-move") {
      handleSceneTokenMove(client, message);
      return;
    }

    if (message.type === "scene:blocked-edge-set") {
      handleBlockedEdgeSet(client, message);
      return;
    }

    if (message.type === "scene:blocked-edges-clear") {
      handleBlockedEdgesClear(client);
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
