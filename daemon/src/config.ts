// Daemon server configuration.
//
// Task 1.2 binds to loopback only. The opt-in wider bind (routable interface +
// required auth token) is task 1.3, which will extend this module — hence the
// host is derived here rather than hard-coded at the listen call.

export const LOOPBACK_HOST = "127.0.0.1";
export const DEFAULT_PORT = 4317;

export interface ServerConfig {
  host: string;
  port: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = env.SHODAN_PORT ? Number.parseInt(env.SHODAN_PORT, 10) : DEFAULT_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid SHODAN_PORT: ${env.SHODAN_PORT ?? ""}`);
  }
  // Loopback only in this task; task 1.3 introduces the guarded wider bind.
  return { host: LOOPBACK_HOST, port };
}
