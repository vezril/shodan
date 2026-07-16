# Design — Pineapple Recon Console (foundation + recon MVP)

## Context

The Pineapple MK7's value is a web UI over a pile of root-level Linux radio
operations. We are rebuilding the UI half in Next.js and the radio half as a
daemon on a Lenovo T470 (Linux), driven by the surviving MK7AC dongle
(MediaTek **MT7612U**, `mt76x2u` driver — monitor mode + injection supported in
mainline Linux).

Two hard constraints shape everything:

1. **Multiple radios; modes conflict only *per radio*.** The operator has several
   usable radios (the MK7AC MT7612U among them; the T470's internal Intel card is
   not attack-capable) — two usable radios in total. On a single radio, modes conflict — recon hops channels
   while an AP must camp — so each radio runs one mode at a time. But different
   radios can run different modes concurrently, so the daemon arbitrates a *pool*,
   not a single card.
2. **The engine is Linux-bound; the operator is on a Mac.** See *Platform
   Constraints* below — this folds in the macOS compatibility spike.

## Goals / Non-Goals

**Goals**
- Live recon dashboard (APs + clients, updating) usable from the operator's Mac.
- An architecture where recon is the first of many capabilities behind a stable
  adapter interface, so capture/AP/deauth slot in later without a rewrite.
- Honest radio model: the UI never pretends two conflicting modes share one radio;
  concurrency is expressed as modes on distinct radios.
- Keep RF activity inside the lab by construction (scope guard, loopback daemon).

**Non-Goals**
- Handshake/PMKID capture, rogue AP / evil twin, deauth — future changes.
- Multi-radio concurrency — the pool is modeled and per-radio capabilities are
  reported, but concurrent modes are not *exercised* in this recon-only change.
- Running any radio operation on macOS, or via a VM on Apple Silicon.
- Exposing the daemon on the LAN / multi-user auth beyond loopback + tunnel.

## Decisions

### D1 — Cockpit/engine split over a REST + stream seam
Next.js cannot cleanly hold monitor mode or spawn root radio tools. The daemon
owns the radio and exposes **capabilities** (Recon, later Capture/AP/Deauth) over
REST (commands) + WebSocket/SSE (live recon firehose). The UI is a control
surface, not a radio host.
*Alternative considered:* one Next.js app with route handlers doing radio work —
rejected; can't hold interfaces/root processes cleanly, and pins UI to the box.

### D2 — Wrap bettercap as the engine (recon now, attack suite later)
The console is meant to grow attack features (capture, deauth, eventually evil
twin), so the engine is **bettercap**: one Go binary with a REST API + WebSocket
event feed whose `wifi` module already spans recon → handshake capture → deauth.
Wrapping it means one adapter family backs the middle of the roadmap instead of
stitching several tools together. Recon is served by a `ReconAdapter` over
bettercap's API today; `CaptureAdapter`/`DeauthAdapter` reuse the same engine in
later changes. Rogue AP / evil twin still add `hostapd-mana` (bettercap does not
stand up a real AP).

**Consequence — recon runs on an attack-capable engine.** We give up kismet's
"cannot attack" property, so the safety layer moves to three rules, all enforced
by the daemon:
1. The daemon exposes **only the capabilities we have built** — never a raw
   bettercap command passthrough. bettercap's deauth/AP primitives are not
   reachable until their gated capability changes land.
2. Every active capability routes through the **scope guard** (D6) and the
   **radio-mode state machine** (D4).
3. bettercap is launched with recon-only surface in this change; attack modules
   are wired in deliberately, one gated change at a time.

*Alternative considered:* kismet — deeper recon (device history, probes, manuf),
passive by design, but recon-only, so the attack roadmap would need a second
engine bolted on. Rejected in favor of one coherent engine for the suite. kismet
remains available later as a read-only recon-enrichment source if wanted.

### D3 — Capability/adapter layer
The UI and daemon speak abstract operations; each is backed by whatever engine
does it best (bettercap for recon/capture/deauth, hostapd-mana for the AP module).
Adds a `MockRadioAdapter` (synthetic recon) so the full stack runs on the Mac for
dev.
*Why:* MVP wires only Recon, but the contracts already assume the full suite.

### D4 — Radio as an exclusive mode state machine
On any single radio, recon (monitor + hop), capture (monitor + camp/inject), and
AP (fixed channel) physically conflict. The daemon models each radio as a
resource with a single active mode; transitions are explicit and serialized;
conflicting actions on the same radio are blocked/queued with a clear reason.
Radios form a pool, so with multiple present the daemon can place conflicting
modes on different radios concurrently.

```
        ┌── IDLE ──┐
        │          │
   ┌──RECON──┐ ┌─CAPTURE─┐ ┌──AP──┐   (mutually exclusive; one at a time)
   │ monitor │ │ monitor │ │master│
   │  + hop  │ │+camp/inj│ │fixed │
   └─────────┘ └─────────┘ └──────┘
     exclusive PER RADIO; with multiple radios, modes run concurrently on
     different cards. Only RECON is implemented here; others are reserved states
```

### D5 — Daemon language: TypeScript/Node (revisit per adapter)
Wrapping bettercap makes the daemon largely a proxy/aggregator; TS shares the
frontend language and ships fastest. The adapter boundary lets a hot adapter be
rewritten in Go later without touching the UI. *Alternative:* Go daemon (better
system service, bettercap precedent) — deferred; not worth two languages yet.

### D6 — Scope guard is a feature, not a checkbox
An engagement-scope allowlist (in-scope BSSIDs/SSIDs) with observe-only default.
Passive recon is always allowed; any future active op must resolve to an
in-scope target or be refused. It doubles as the seatbelt against RF spilling
onto neighbors.

### D7 — Recon is stream-first (live situational awareness)
The recon dashboard models "what's around me right now," not "survey → save →
diff." The daemon holds authoritative live state, pushes a snapshot on connect,
then streams incremental add/update events; the UI updates rows in place. This
matches how the console is actually used (walk into a space, watch it populate)
and keeps the daemon's state model simple (a live table, not a history store).
*Alternative considered:* snapshot-first "survey + diff" (sweep, persist, compare
against a prior run) — deferred to a later `recon-survey` capability that can sit
on top of the same live stream (a survey is just a captured snapshot). Building
stream-first first does not foreclose it.

### D8 — Multiple radios available: concurrency is designed and available
The operator has multiple usable radios, so the single-radio constraint is
lifted. The radio pool (D4) has more than one real resource, and the daemon
assigns a mode per radio — unlocking concurrent modes (recon while an AP runs;
deauth on radio B while capturing on radio A) and making the evil-twin module
achievable with existing hardware, no purchase required. Radio capability varies
(dual-band monitor+inject vs. 2.4 GHz-only injector vs. AP-capable), so the
daemon enumerates each radio's capabilities and assigns roles to matching cards.
This change (recon MVP) still uses a single radio for recon and leaves the rest
of the pool idle; concurrency is *exercised* by the later capture/deauth/AP
changes, but the pool model and per-radio capability reporting are real from day
one. *Supersedes the earlier single-radio default.*

The pool is **two radios**: the MK7AC (MT7612U, dual-band monitor + injection) plus
one more. Two radios is exactly enough for evil twin (AP on one, deauth on the
other). The second radio's chipset determines its inject/AP role and is confirmed
at enumeration.

### D9 — Auth: tunnel-trust by default, token required for any wider bind
Loopback and private-tunnel access (Tailscale or SSH) carry no separate daemon
login — the tunnel/loopback is the boundary and, on a solo tailnet, nothing else
can reach it. But audits often run with no tailnet: on-site the console is driven
either on the T470 itself (localhost, always fine) or from a nearby device.
Driving from a nearby device means binding beyond loopback, which the daemon
permits ONLY with an explicit opt-in AND a required auth token — never a silent or
unauthenticated LAN listener. So the token is not omitted; it is the key that
safely unlocks the opt-in local-network access mode. Tailscale is one remote
option among several, not the required path.

### D10 — Engine surface: adapter whitelist
The recon release has no code path to bettercap's attack primitives — the daemon
calls only recon endpoints, so a bug or stray request cannot fire deauth/AP. That
is the entire safety mechanism while the app is read-only. A constrained
recon-only caplet (engine-level defense-in-depth) can be added when the first
attack module lands and the scope guard (D6) begins gating real transmissions.

## Platform Constraints — macOS compatibility spike (folded in)

**Operator machine:** Apple Silicon (arm64), macOS 26.0.1. **Verdict: the radio
layer cannot run on macOS — the Mac is a cockpit only.** This validated putting
the engine on the Linux T470.

| Layer | macOS-native (arm64)? | Finding |
|---|---|---|
| Next.js UI in a browser | ✅ | Pure HTTP — Safari drives the T470 daemon fine. |
| Frontend + daemon dev | ✅ | Node/Next run natively; `MockRadioAdapter` runs the whole stack on the Mac. |
| MK7AC (MT7612U) monitor/injection | ❌ | Only 2016-era kexts exist, pre-Apple-Silicon. No arm64 driver. |
| kismet with the MK7AC | ❌ | macOS datasource is CoreWLAN → internal Airport card only; "does not work with generic USB WiFi devices." |
| bettercap wifi on macOS | ⚠️ | Internal `en0` only; upstream marks `wifi.*` "untested and probably buggy on macOS." |
| `airport` sniff CLI | ❌ | Removed in macOS 14.4; confirmed absent on 26.0.1. |
| Linux VM + USB passthrough of the dongle | ⚠️ | Works in theory (MT7612U in-kernel ≥4.19) but USB passthrough on Apple Silicon is documented as flaky/"unusable" — devices vanish, corruption, SIP friction. Not a dependable engine. |

**Consequences baked into the design**
- **Topology:** macOS ⇒ cockpit (browser + dev); Linux T470 ⇒ engine. Because the
  UI is a web app, `localhost`-on-T470 and `Mac-browser`-remote are the same
  daemon; only the reach differs.
- **Remote access (security):** loopback by default; reachable same-box, over a
  **Tailscale/SSH tunnel**, or via an opt-in local-network bind for a nearby
  device — the last requiring an auth token, so never an *unauthenticated* LAN
  port. Tailscale is one option, not the only path.
- **VM path rejected** for the primary engine on this Apple Silicon Mac.
- **Dev ergonomics:** `MockRadioAdapter` makes the Mac a first-class dev host;
  real-radio integration is the only step that must happen on the T470.

*Sources:* Intuitibits "Goodbye, airport!"; kismet macOS CoreWLAN datasource +
install docs; bettercap issue #61; morrownr/7612u (Linux); Yupitek ALFA-on-Mac
2026 compatibility report; QEMU Apple-Silicon USB-passthrough issue; UTM #3300.

## Risks / Trade-offs

- **Radio contention on any single card** → modes are exclusive per radio; with
  multiple radios the pool assigns conflicting modes to different cards. Enumerate
  per-radio capabilities so inject/AP work lands only on capable radios.
- **Root daemon = high-value target** → loopback-only bind + tunnel; no LAN
  listener; scope guard limits blast radius.
- **bettercap coupling** → hide it behind the adapter interface; kismet available
  later as a recon-enrichment source if its depth is wanted.
- **Attack-capable engine during recon** → daemon exposes only built capabilities
  (no raw passthrough); scope guard + mode machine gate every active op.
- **USB passthrough temptation on the Mac** → explicitly rejected; don't sink
  time into an unreliable Apple-Silicon path.
- **TS daemon doing root process mgmt** → keep the daemon a thin orchestrator;
  escalate an adapter to Go only if lifecycle pain appears.

## Migration Plan

Greenfield — no rollback of existing behavior. Rollout: (1) daemon + Mock
adapter, full stack green on the Mac; (2) bettercap ReconAdapter on the T470; (3)
Tailscale/tunnel so the Mac cockpit drives the T470 engine. Each step is
independently demoable.

## Open Questions

- **Second radio's chipset:** one radio is the MK7AC (MT7612U); confirm the
  second's chipset at enumeration to know its injection/AP role. Not blocking —
  the daemon reports capabilities at runtime.
