import { timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { ServerConfig } from "./config.js";
import type { StreamMessage } from "./contract.js";
import type { ReconAdapter } from "./recon/adapter.js";

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

function writeSse(res: ServerResponse, message: StreamMessage): void {
  res.write(`data: ${JSON.stringify(message)}\n\n`);
}

// Live recon stream: send the snapshot on connect, then forward the adapter's
// incremental deltas. Unsubscribe + clear the heartbeat when the client leaves.
function openSseStream(
  req: IncomingMessage,
  res: ServerResponse,
  adapter: ReconAdapter,
): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });
  res.write(": connected\n\n");

  // Snapshot first, then deltas (recon-dashboard "snapshot on connect").
  writeSse(res, adapter.snapshot());
  const unsubscribe = adapter.subscribe((event) => writeSse(res, event));

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15_000);
  heartbeat.unref?.();

  const close = (): void => {
    clearInterval(heartbeat);
    unsubscribe();
  };
  req.on("close", close);
  res.on("close", close);
}

export function createDaemonServer(config: ServerConfig, adapter: ReconAdapter): Server {
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
      openSseStream(req, res, adapter);
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  });
}
