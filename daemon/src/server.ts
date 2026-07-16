import { timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { ServerConfig } from "./config.js";

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

// Constant-time bearer-token check. The token is read from the Authorization
// header (never a query string — secrets must not land in URLs/logs). Browser
// EventSource cannot set headers, so the cockpit consumes the SSE stream via
// fetch streaming to carry this header.
function isAuthorized(req: IncomingMessage, token: string): boolean {
  const header = req.headers.authorization;
  const prefix = "Bearer ";
  if (!header || !header.startsWith(prefix)) return false;
  const presented = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(token);
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}

// Server-Sent Events stream. The recon snapshot-on-connect and incremental
// deltas are wired in tasks 1.4 / 2.3; here the endpoint just establishes the
// stream and keeps it alive so clients can subscribe.
function openSseStream(req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });
  res.write(": connected\n\n");

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15_000);
  heartbeat.unref?.();

  const close = (): void => clearInterval(heartbeat);
  req.on("close", close);
  res.on("close", close);
}

export function createDaemonServer(config: ServerConfig): Server {
  return createServer((req, res) => {
    // On a wider bind, every request must present the token.
    if (config.requireToken && !(config.token && isAuthorized(req, config.token))) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const { pathname } = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "GET" && pathname === "/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    if (req.method === "GET" && pathname === "/api/stream") {
      openSseStream(req, res);
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  });
}
