# Access modes

The daemon runs as **root** and controls radios that can transmit, so it must
never sit unauthenticated on a network. It **binds to loopback by default** and
refuses to bind to a routable interface unless you explicitly opt in *and*
configure an auth token. There are three ways to reach the cockpit; they map onto
two binds.

## 1. Same-box (localhost) — the default

Run the daemon and a browser on the engine itself. The cockpit talks to
`127.0.0.1`; nothing is exposed on the network.

```bash
npm run dev          # daemon on 127.0.0.1:4317, web on :3000
# open http://localhost:3000 on the engine
```

This is the simplest **field-audit** setup: you're at a site with the laptop, no
network required.

## 2. Tailscale / SSH tunnel — remote from your Mac

The daemon stays on loopback; a private tunnel forwards to it. Nothing is
published to the LAN. Use this from your Mac at home/lab.

```bash
# SSH tunnel: forward local :4317 to the engine's loopback daemon
ssh -N -L 4317:127.0.0.1:4317 you@t470
# …or reach the engine's loopback over Tailscale (tailnet ACLs are the boundary)
```

Point the web dev proxy at the forwarded port with `DAEMON_URL`, or run the built
cockpit on the engine and browse it over the tunnel.

## 3. Opt-in local-network bind — a nearby device

For a field audit driven from a **nearby phone/tablet** when there's no tailnet.
The daemon binds to a routable interface, and **every request must carry the auth
token**. This is refused unless you opt in *and* set a token.

```bash
SHODAN_HOST=0.0.0.0 \
SHODAN_ALLOW_WIDER_BIND=1 \
SHODAN_TOKEN='<a-strong-random-token>' \
npm run dev:daemon
```

- The token goes in `Authorization: Bearer <token>` — **never** a query string.
- Because `EventSource` cannot set headers, the cockpit consumes the SSE stream
  via fetch-streaming to carry the token.
- Only do this on a network you trust; prefer modes 1–2 when you can.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `SHODAN_PORT` | `4317` | daemon port |
| `SHODAN_HOST` | `127.0.0.1` | bind host; a non-loopback value requires the two below |
| `SHODAN_ALLOW_WIDER_BIND` | (unset) | `1` to opt in to a routable bind |
| `SHODAN_TOKEN` | (unset) | bearer token; required for a routable bind |
| `SHODAN_SCOPE_FILE` | `~/.shodan/scope.json` | where the engagement scope is persisted |
| `SHODAN_MOCK_TICK_MS` | `1500` | mock recon mutation interval (dev) |
| `DAEMON_URL` | `http://127.0.0.1:4317` | where the web dev proxy forwards `/api/*` |

## Safety summary

- Loopback is the default; a routable bind needs **opt-in + token**, so there is
  never an unauthenticated routable listener.
- The engine is Linux-only; on macOS the daemon runs against the mock adapter for
  development (the Mac is a cockpit, not an engine).
