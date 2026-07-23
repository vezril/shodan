# Verification

## Same-box end-to-end (macOS dev host, mock adapter) — ✅ verified

Run `npm run dev`, open http://localhost:3000:

- [x] Daemon binds loopback (`127.0.0.1:4317`); web on `:3000`; SSE proxied same-origin.
- [x] Live AP inventory table populates from the snapshot (SSID/BSSID/Ch/Band/Encryption/Signal/Clients/Scope).
- [x] Table updates in place from deltas — no duplicate rows, no manual refresh.
- [x] Clicking an AP drills into its clients (MAC/signal/last-seen), updating live.
- [x] `PUT /api/scope` persists; an in-scope AP shows the green "in scope" badge + rail, others "out".
- [x] `GET /api/radios` reports the pool (capabilities + mode); `GET /api/scope` reports the scope.
- [x] Access modes: loopback (same-box), and the token-gated routable bind (401 without token, 200 with).

## On the T470 (Linux + MK7AC) — ⏳ pending real hardware

These touch the radio and need the Linux engine; verify when next at the T470:

- [ ] `GET /api/radios` lists the real MK7AC (MT7612U) via `iw`, with monitor/injection/AP capabilities.
- [ ] Radio mode transitions actually reconfigure the interface (`ip`/`iw`): RECON → monitor, IDLE → managed (never left stuck in monitor).
- [ ] Safe teardown on `SIGINT`/`SIGTERM` restores the interface.
- [ ] bettercap adapter (group 5) streams real recon in the same snapshot/delta shapes — the UI is unchanged when swapping mock → bettercap.
- [ ] Mac → Tailscale/SSH tunnel → T470 daemon → bettercap → live recon in the cockpit.

## Known follow-up

- A scope change (`PUT /api/scope`) re-stamps `inScope` on APs at their next
  `ap.upsert` (or a page reload), not immediately for already-displayed rows on a
  live connection. A future improvement: push a fresh snapshot to connected
  clients when the scope changes.
