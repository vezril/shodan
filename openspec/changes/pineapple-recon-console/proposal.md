## Why

The WiFi Pineapple MK7 base unit is dead, but its MK7AC (MediaTek MT7612U) USB
radio still works on a Lenovo T470 running Linux. Rather than drive WiFi lab
chores by hand with `airodump-ng`/`kismet`/`hostapd`, we want a self-hosted,
Pineapple-style web console that automates them — starting with **recon and live
situational awareness**, on a radio-pool architecture (modes exclusive per radio,
concurrent across radios) that can grow into the full suite (capture, rogue AP,
deauth) later.

This first change delivers the **foundation + recon MVP**: the daemon that owns
the radio, the engine-agnostic adapter layer, the live recon dashboard, and the
scope guard that keeps RF activity inside the lab. Capture and active/AP modules
are deliberately deferred to follow-on changes so this one stays shippable.

## What Changes

- **New Next.js console (cockpit)** — a browser UI that renders a live, updating
  view of APs and clients in range. Runs anywhere, including the operator's Mac.
- **New orchestration daemon (engine)** — a root-level Linux service that owns
  the single MK7AC radio as an exclusive, mode-switched resource, exposes
  *capabilities* (not raw tools) over REST + a WebSocket/SSE live stream, and
  binds to loopback only.
- **Engine-agnostic adapter layer** — recon is backed by **bettercap** (chosen so
  the same engine grows into capture/deauth) behind a stable interface; a
  `MockRadioAdapter` emits synthetic recon so the whole stack runs on the Mac for
  development. The daemon exposes only built capabilities — never a raw bettercap
  passthrough — so its attack primitives stay unreachable until their gated
  changes land.
- **Radio state machine over a radio pool** — recon / capture / AP are mutually
  exclusive *per radio*; the daemon arbitrates a pool of radios and, because
  multiple are available, can run different modes on different radios
  concurrently. The recon MVP uses one radio and leaves the rest available.
- **Scope guard** — a first-class allowlist of in-scope BSSIDs/SSIDs; everything
  else is observe-only. Active operations against out-of-scope targets are
  blocked. (Passive in the recon MVP; load-bearing once active modules land.)
- **Deployment topology decided** — macOS is a *cockpit only* (browser + dev);
  the Linux T470 is the *engine*. The console is reachable three ways: same-box
  localhost (field audits, no network needed), a Tailscale/SSH tunnel (home/lab
  remote), and an opt-in local-network bind for a nearby device — the last gated
  by an auth token so there is never an unauthenticated LAN port. (See design.md —
  folds in the macOS compatibility spike.)
- **NOT in this change (BREAKING scope note):** handshake/PMKID capture, rogue
  AP / evil twin, and deauth are out of scope here; they become separate changes
  behind the same adapter interface this change establishes.

## Capabilities

### New Capabilities
- `recon-dashboard`: live situational-awareness view of APs and clients derived
  from the radio, streamed to the browser and updating in near-real-time.
- `radio-control`: management of the single MK7AC radio — enumeration, monitor
  mode, channel hopping, and the exclusive radio-mode state machine.
- `scope-guard`: engagement-scope allowlist that keeps activity inside the lab
  and gates any future active operations.
- `console-access`: how the cockpit reaches the engine — loopback binding,
  Tailscale/tunnel remote access, and the platform topology (macOS ⇒ cockpit,
  Linux ⇒ engine).

### Modified Capabilities
<!-- none — greenfield project, no existing specs -->

## Impact

- **New services:** `web/` (Next.js console), `daemon/` (Linux orchestration
  service running as root).
- **External dependencies:** bettercap (engine — recon now, capture/deauth later —
  wrapped via its REST API + event stream); `hostapd-mana` added later for the AP
  module; the `mt76`/`mt76x2u` in-kernel driver for the MK7AC; Tailscale or SSH
  for remote cockpit access.
- **Hardware:** Lenovo T470 (Linux) with two usable radios (the MK7AC MT7612U +
  one more) — enough for evil twin later (AP on one, deauth on the other).
  Concurrency is designed and available; the recon MVP exercises one radio and the
  daemon reports each radio's capabilities.
- **Platform:** engine is Linux-only; macOS (arm64) cannot run the radio layer —
  it is a browser/dev host only. No VM-on-Apple-Silicon engine path.
- **Security surface:** a root radio daemon — must never be exposed
  *unauthenticated* on a network. Loopback is the default; any wider bind requires
  an explicit opt-in AND an auth token.
