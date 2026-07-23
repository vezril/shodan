import { timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { ServerConfig } from "./config.js";
import type { StreamMessage } from "@shodan/contract";
import type { RadioPool } from "./radio/index.js";
import type { ReconAdapter } from "./recon/adapter.js";
import type { Scope, ScopeGuard } from "./scope/guard.js";

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

// Stamp inScope on APs from the scope guard at send time. Recon observes every
// AP regardless of scope (observe-only default); the guard only decides how each
// AP is labelled. The radio itself never knows scope — the daemon stamps it.
function stampScope(message: StreamMessage, scopeGuard: ScopeGuard): StreamMessage {
  if (message.type === "snapshot") {
    return {
      ...message,
      accessPoints: message.accessPoints.map((ap) => ({ ...ap, inScope: scopeGuard.isInScope(ap) })),
    };
  }
  if (message.type === "ap.upsert") {
    return { ...message, ap: { ...message.ap, inScope: scopeGuard.isInScope(message.ap) } };
  }
  return message;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error("body too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// Live recon stream: send the snapshot on connect, then forward the adapter's
// incremental deltas. Unsubscribe + clear the heartbeat when the client leaves.
function openSseStream(
  req: IncomingMessage,
  res: ServerResponse,
  adapter: ReconAdapter,
  scopeGuard: ScopeGuard,
): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });
  res.write(": connected\n\n");

  // Snapshot first, then deltas (recon-dashboard "snapshot on connect"). Each
  // message is scope-stamped at send time.
  writeSse(res, stampScope(adapter.snapshot(), scopeGuard));
  const unsubscribe = adapter.subscribe((event) => writeSse(res, stampScope(event, scopeGuard)));

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

export function createDaemonServer(
  config: ServerConfig,
  adapter: ReconAdapter,
  radioPool: RadioPool,
  scopeGuard: ScopeGuard,
): Server {
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

    if (req.method === "GET" && pathname === "/api/radios") {
      sendJson(res, 200, { radios: radioPool.list() });
      return;
    }

    if (req.method === "GET" && pathname === "/api/scope") {
      sendJson(res, 200, { scope: scopeGuard.getScope() });
      return;
    }

    if (req.method === "PUT" && pathname === "/api/scope") {
      readBody(req).then(
        (body) => {
          let parsed: unknown;
          try {
            parsed = body ? JSON.parse(body) : {};
          } catch {
            sendJson(res, 400, { error: "invalid_json" });
            return;
          }
          scopeGuard.setScope(parsed as Partial<Scope>).then(
            (scope) => sendJson(res, 200, { scope }),
            () => sendJson(res, 500, { error: "persist_failed" }),
          );
        },
        () => sendJson(res, 400, { error: "read_failed" }),
      );
      return;
    }

    if (req.method === "GET" && pathname === "/api/stream") {
      openSseStream(req, res, adapter, scopeGuard);
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  });
}
