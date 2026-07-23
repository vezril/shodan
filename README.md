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

## Access modes

The daemon runs as root and controls radios, so it binds to **loopback by
default** and never sits unauthenticated on a network. Three ways to reach it:

- **Same-box (localhost)** — browser on the engine; the default, and the simplest
  field-audit setup.
- **Tailscale / SSH tunnel** — remote from your Mac; the daemon stays on loopback
  and the tunnel forwards to it.
- **Opt-in local-network bind** — a nearby phone/tablet at a site with no tailnet;
  requires `SHODAN_ALLOW_WIDER_BIND=1` **and** `SHODAN_TOKEN`, and every request
  must carry the token.

Full details, commands, and env vars: **[docs/access-modes.md](docs/access-modes.md)**.

## Radio model

The daemon models radios as a **pool** (design D4/D8). Each radio has one active
mode — `IDLE`, `RECON`, and reserved `CAPTURE`/`AP` — and modes are exclusive
*per radio*, so conflicting modes run on different cards concurrently (enough for
evil twin with two radios). Enumeration reports each radio's driver and
monitor/injection/AP capabilities. On Linux this is real (`iw`); on macOS a
representative mock pool stands in.

## Scope

An **engagement scope** (allowlist of in-scope BSSIDs/SSIDs) marks the operator's
own lab. Recon is **observe-only** — every AP is shown regardless of scope — but
the daemon stamps `inScope` on each AP so the cockpit can distinguish them, and
any future active operation (capture/deauth/AP) is refused unless its target is in
scope. Scope is persisted (`SHODAN_SCOPE_FILE`) and survives restarts.

## HTTP API

| Method / path | Purpose |
|---|---|
| `GET /health` | liveness |
| `GET /api/stream` | SSE: snapshot on connect, then recon deltas |
| `GET /api/radios` | radio pool: capabilities + current mode |
| `GET /api/scope` | current engagement scope |
| `PUT /api/scope` | set + persist the engagement scope |

## License

MIT — see [LICENSE.md](LICENSE.md).
