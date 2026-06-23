import { port } from "./src/config.mjs";
import { createHttpServer } from "./src/http/server.mjs";
import { attachWebSocketServer } from "./src/ws/connection.mjs";
import { startPingInterval } from "./src/ws/ping.mjs";

const server = createHttpServer();

attachWebSocketServer(server);
startPingInterval();

server.listen(port, () => {
  console.log(`TRPG sync server listening on http://localhost:${port}`);
});
