import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
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

export function createDaemonServer(): Server {
  return createServer((req, res) => {
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
