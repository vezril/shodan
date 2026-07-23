// Daemon server configuration and the loopback/wider-bind guard.
//
// Loopback is the default and needs no auth (the tunnel/loopback is the
// boundary — design D9). Binding to any routable interface is permitted ONLY
// with BOTH an explicit opt-in AND a configured auth token; otherwise the
// daemon refuses to start. There is never an unauthenticated routable listener.

export const LOOPBACK_HOST = "127.0.0.1";
export const DEFAULT_PORT = 4317;

export interface ServerConfig {
  host: string;
  port: number;
  /** True when bound to a routable interface — every request must present the token. */
  requireToken: boolean;
  /** The bearer token; set when a wider bind is configured, otherwise null. */
  token: string | null;
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host) || host.startsWith("127.");
}

function isOptIn(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = env.SHODAN_PORT ? Number.parseInt(env.SHODAN_PORT, 10) : DEFAULT_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid SHODAN_PORT: ${env.SHODAN_PORT ?? ""}`);
  }

  const host = env.SHODAN_HOST?.trim() || LOOPBACK_HOST;
  const token = env.SHODAN_TOKEN?.trim() || null;
  const loopback = isLoopbackHost(host);

  if (!loopback) {
    if (!isOptIn(env.SHODAN_ALLOW_WIDER_BIND)) {
      throw new Error(
        `Refusing to bind to ${host}: a non-loopback bind requires the explicit ` +
          `opt-in SHODAN_ALLOW_WIDER_BIND=1.`,
      );
    }
    if (!token) {
      throw new Error(
        `Refusing to bind to ${host}: a non-loopback bind requires SHODAN_TOKEN ` +
          `(no unauthenticated routable listener).`,
      );
    }
  }

  return { host, port, requireToken: !loopback, token };
}

// The three supported access modes map onto two binds:
//   - loopback  → same-box (browser on the engine) OR remote over a
//                 Tailscale/SSH tunnel that forwards to loopback
//   - routable  → opt-in local-network bind for a nearby device, token-required
export function describeAccessMode(config: ServerConfig): string {
  return config.requireToken
    ? `local-network bind on ${config.host}:${config.port} — auth token REQUIRED; reach it from a nearby device`
    : `loopback only — same-box (http://127.0.0.1:${config.port}) or via a Tailscale/SSH tunnel`;
}
