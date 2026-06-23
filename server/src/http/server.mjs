import { createServer } from "node:http";
import { clients } from "../state/index.mjs";

export function createHttpServer() {
  return createServer((request, response) => {
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
}
