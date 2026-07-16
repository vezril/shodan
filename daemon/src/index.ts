// Entry point for the shodan recon daemon (the "engine").
//
// Task 1.2: a loopback-bound HTTP server exposing /health and an SSE live
// stream at /api/stream. The ReconAdapter and mock adapter (tasks 2.x) plug
// into the stream next; the token-gated wider bind is task 1.3.
import { loadConfig } from "./config.js";
import { createDaemonServer } from "./server.js";

function main(): void {
  const config = loadConfig();
  const server = createDaemonServer();

  server.listen(config.port, config.host, () => {
    console.log(
      `shodan daemon listening on http://${config.host}:${config.port} (loopback only)`,
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
