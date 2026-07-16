// Entry point for the shodan recon daemon (the "engine").
//
// A loopback-bound HTTP server exposing /health and an SSE live stream at
// /api/stream, with a guarded wider bind (opt-in + auth token, task 1.3). The
// ReconAdapter and mock adapter (tasks 2.x) plug into the stream next.
import { loadConfig } from "./config.js";
import { createDaemonServer } from "./server.js";

function main(): void {
  const config = loadConfig();
  const server = createDaemonServer(config);

  server.listen(config.port, config.host, () => {
    const mode = config.requireToken
      ? "wider bind — auth token REQUIRED on every request"
      : "loopback only";
    console.log(
      `shodan daemon listening on http://${config.host}:${config.port} (${mode})`,
    );
  });

  const shutdown = (signal: string): void => {
    console.log(`\n${signal} received — shutting down`);
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();
