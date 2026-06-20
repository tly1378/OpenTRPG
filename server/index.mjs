import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const pingIntervalMs = 2500;

const clients = new Map();

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

function handleHello(client, message) {
  if (!message.identity || typeof message.identity !== "object") {
    return;
  }

  client.identity = {
    id: String(message.identity.id ?? client.clientId),
    name: String(message.identity.name ?? "未知用户"),
    type: message.identity.type === "admin" ? "admin" : "player",
  };
  client.lastSeenAt = Date.now();
  sendJson(client.socket, {
    type: "hello",
    clientId: client.clientId,
    serverTime: client.lastSeenAt,
  });
  broadcastStatus();
}

function handlePong(client, message) {
  if (typeof message.sentAt !== "number") {
    return;
  }

  client.latencyMs = Math.max(0, Date.now() - message.sentAt);
  client.lastSeenAt = Date.now();
  broadcastStatus();
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
