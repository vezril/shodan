# shodan

A self-hosted, WiFi Pineapple-style **recon/capture console** for a personal WiFi
lab. A browser **cockpit** drives a root **daemon** that owns the radios; the
daemon streams a live inventory of access points and clients to the UI.

This is an in-progress build. The current milestone is the **recon MVP**: a live
AP/client dashboard fed by a mock radio so the whole stack runs with no hardware.
Capture, deauth, and rogue AP / evil twin are planned follow-on work. See
[`openspec/changes/pineapple-recon-console`](openspec/changes/pineapple-recon-console)
for the full proposal, design decisions, and task list.

## Architecture

```
   Mac / browser            Linux box (the engine)
   ─────────────            ──────────────────────
   @shodan/web   ── HTTP + SSE ──▶  @shodan/daemon ──▶ radio adapter
   (cockpit)                        (loopback by       (mock today;
                                     default)           bettercap later)
              both speak @shodan/contract (the wire types)
```

- **`web/`** (`@shodan/web`) — Next.js cockpit. Runs anywhere, including macOS.
- **`daemon/`** (`@shodan/daemon`) — the engine. Owns the radios, binds to
  loopback by default, streams recon over SSE. The radio layer is Linux-only; on
  macOS the daemon runs against the **mock adapter** for development.
- **`contract/`** (`@shodan/contract`) — the shared daemon↔cockpit wire types.

## Development (macOS or Linux)

Prerequisites: **Node 22+**.

```bash
npm install
npm run dev
```

`npm run dev` starts the daemon (loopback `127.0.0.1:4317`) and the Next.js dev
server together. Open **http://localhost:3000** — the cockpit connects to the
daemon through a same-origin proxy and shows the live AP inventory. Click an AP
to drill into its clients.

With no radio, the daemon uses the mock adapter, so the full stack works on a Mac.
Useful env vars:

| Variable | Default | Purpose |
|---|---|---|
| `SHODAN_PORT` | `4317` | daemon port |
| `SHODAN_MOCK_TICK_MS` | `1500` | mock recon mutation interval |
| `DAEMON_URL` | `http://127.0.0.1:4317` | where the web dev proxy forwards `/api/*` |

Type-check everything with `npm run typecheck`.

## License

MIT — see [LICENSE.md](LICENSE.md).
