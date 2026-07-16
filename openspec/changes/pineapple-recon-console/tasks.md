## 1. Monorepo & daemon skeleton

- [x] 1.1 Lay out `web/` (Next.js) and `daemon/` (TypeScript/Node) workspaces
- [x] 1.2 Daemon HTTP server + WebSocket/SSE stream, bound to loopback only
- [x] 1.3 Refuse to bind beyond loopback unless BOTH an explicit opt-in and an auth token are set
- [x] 1.4 Define the daemon↔UI contract: snapshot shape + incremental event shape

## 2. Adapter layer & mock engine

- [x] 2.1 Define the `ReconAdapter` interface (start/stop, snapshot, event stream)
- [x] 2.2 Implement `MockRadioAdapter` emitting synthetic APs/clients over time
- [x] 2.3 Wire the daemon to serve snapshot-on-connect then deltas

## 3. Recon dashboard (UI)

- [ ] 3.1 Live AP inventory table (SSID, BSSID, channel, band, encryption, signal, #clients)
- [ ] 3.2 In-place updates from the stream (no dup rows, no manual refresh)
- [ ] 3.3 AP drill-in: associated/probing clients with live updates
- [ ] 3.4 Visual in-scope vs out-of-scope distinction
- [ ] 3.5 Full stack runs on the macOS dev host against the mock adapter

## 4. Radio control

- [ ] 4.1 Enumerate interfaces; report MK7AC chipset/driver + monitor availability
- [ ] 4.2 Radio-mode state machine (`IDLE`/`RECON`, reserved `CAPTURE`/`AP`)
- [ ] 4.3 Serialize transitions; refuse conflicting requests with the active mode as reason
- [ ] 4.4 Model radios as a pool; enumerate + report per-radio capabilities (monitor/inject/AP)
- [ ] 4.5 Safe teardown: leave monitor mode / release the interface on stop/shutdown

## 5. bettercap recon adapter (on the T470)

- [ ] 5.1 Implement `BettercapAdapter` against bettercap's REST API + event stream
- [ ] 5.2 Launch bettercap with a recon-only surface (no attack primitives exposed)
- [ ] 5.3 Map bettercap AP/client data to the daemon's snapshot/event shapes
- [ ] 5.4 Enforce "built capabilities only" — daemon rejects any un-built engine command
- [ ] 5.5 Verify UI is unchanged when swapping mock → bettercap

## 6. Scope guard

- [ ] 6.1 Persist an engagement scope (in-scope BSSIDs/SSIDs)
- [ ] 6.2 Observe-only default; recon always allowed
- [ ] 6.3 Gate that refuses out-of-scope active operations (for future modules)

## 7. Access modes, cockpit & docs

- [ ] 7.1 Support three access modes: same-box localhost, Tailscale/SSH tunnel, opt-in local-network bind
- [ ] 7.2 Daemon auth token; required on every request for any non-loopback bind
- [ ] 7.3 Document each access mode, including field-audit (same-box + nearby device)
- [ ] 7.4 Update README: cockpit/engine topology, radio-pool model, access modes, run instructions
- [ ] 7.5 End-to-end check: same-box localhost recon; and Mac → tunnel → bettercap → live recon
