# scope-guard

## ADDED Requirements

### Requirement: Engagement scope allowlist
The daemon SHALL maintain an engagement scope: an allowlist of in-scope BSSIDs
and/or SSIDs defining the operator's own lab. Everything not on the allowlist is
treated as out-of-scope.

#### Scenario: Define the lab scope
- **WHEN** the operator sets the scope to specific BSSIDs/SSIDs
- **THEN** the daemon persists that scope and reports it to the console

#### Scenario: Console distinguishes in-scope from out-of-scope
- **WHEN** the recon inventory is shown
- **THEN** in-scope APs are visually distinguished from out-of-scope APs

### Requirement: Observe-only by default
Passive recon SHALL be permitted for all observed networks, but the system MUST
default to observe-only: no active operation is permitted against any target
until scope is defined and the target is in scope.

#### Scenario: Recon is always allowed
- **WHEN** recon runs
- **THEN** the daemon observes and lists all networks regardless of scope

### Requirement: Active operations are gated by scope
Any future active operation (capture with injection, AP, deauth) SHALL be
refused unless it resolves to an in-scope target. The refusal MUST state that
the target is out of scope. (No active operations ship in this change; the gate
is established for them.)

#### Scenario: Out-of-scope active request is blocked
- **WHEN** an active operation targets a BSSID/SSID not in the allowlist
- **THEN** the daemon refuses it and states the target is out of scope

#### Scenario: In-scope active request is permitted by the guard
- **WHEN** an active operation targets an in-scope BSSID/SSID
- **THEN** the scope guard permits it (subject to radio-mode availability)
