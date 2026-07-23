// Entry point for the shodan recon daemon (the "engine").
//
// A loopback-bound HTTP server exposing /health and an SSE live stream at
// /api/stream that serves a snapshot on connect then forwards recon deltas
// (tasks 1.2–1.4, 2.3). The recon source is the mock adapter for now; the
// bettercap adapter and engine selection arrive in task 5.
import { loadConfig } from "./config.js";
import { selectRadioProvider } from "./radio/index.js";
import { MockRadioAdapter } from "./recon/mock.js";
import { createDaemonServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const rawTick = process.env.SHODAN_MOCK_TICK_MS
    ? Number.parseInt(process.env.SHODAN_MOCK_TICK_MS, 10)
    : undefined;
  const tickMs = Number.isInteger(rawTick) && (rawTick as number) > 0 ? rawTick : undefined;
  const adapter = new MockRadioAdapter({ tickMs });
  await adapter.start();

  const radioProvider = selectRadioProvider();
  const server = createDaemonServer(config, adapter, radioProvider);
  server.listen(config.port, config.host, () => {
    const mode = config.requireToken
      ? "wider bind — auth token REQUIRED on every request"
      : "loopback only";
    console.log(
      `shodan daemon listening on http://${config.host}:${config.port} (${mode}) — engine: ${adapter.name}`,
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n${signal} received — shutting down`);
    await adapter.stop();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
