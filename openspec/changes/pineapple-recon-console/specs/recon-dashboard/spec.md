# recon-dashboard

## ADDED Requirements

### Requirement: Live AP inventory
The console SHALL present a live inventory of access points observed by the
radio, each row showing at minimum SSID, BSSID, channel, band, encryption,
signal strength, and observed client count. The inventory MUST update in
near-real-time as the daemon streams new observations, without a manual refresh.

#### Scenario: A new AP enters range
- **WHEN** the radio observes an AP not currently in the inventory
- **THEN** the daemon emits an add/update event on the live stream
- **AND** the console renders a new row for that AP within a few seconds

#### Scenario: An AP's signal changes
- **WHEN** an already-listed AP's signal strength changes
- **THEN** the console updates that row in place rather than duplicating it

### Requirement: Drill into an AP's clients
The console SHALL let the operator select an AP and view the client stations
associated with or probing it, showing at minimum client MAC, signal, and last-seen time.

#### Scenario: Inspect clients of a selected AP
- **WHEN** the operator selects an AP from the inventory
- **THEN** the console shows the clients the radio has associated with that AP
- **AND** each client row updates as new frames are observed

### Requirement: Engine-agnostic recon source
The recon data SHALL be produced through a `ReconAdapter` interface so the UI is
independent of the underlying engine. The system MUST provide at least a
bettercap adapter (real radio) and a mock adapter (synthetic data) satisfying the
same interface.

#### Scenario: Mock adapter drives the full stack on a dev host
- **WHEN** the daemon is started with the mock recon adapter
- **THEN** the console shows a live, updating AP/client inventory from synthetic data
- **AND** no radio hardware is required

#### Scenario: Swapping engines does not change the UI contract
- **WHEN** the daemon switches from the mock adapter to the bettercap adapter
- **THEN** the console consumes the same event and snapshot shapes without code changes

### Requirement: Only built capabilities are exposed
The daemon SHALL expose only the capabilities implemented in the current release
and MUST NOT provide a raw passthrough to the underlying engine's other commands.
In this change that means recon only; the engine's attack primitives (deauth, AP)
MUST NOT be reachable through the daemon's API.

#### Scenario: Attack primitives are unreachable in the recon release
- **WHEN** a client attempts to invoke an engine attack primitive not backed by a built capability
- **THEN** the daemon rejects the request as unsupported
- **AND** no command reaches the underlying engine

### Requirement: Snapshot on connect
When a client connects to the live stream, the daemon SHALL first deliver a
snapshot of the current inventory, then deliver incremental updates, so a
late-joining console shows current state without waiting for new observations.

#### Scenario: Late-joining console hydrates immediately
- **WHEN** a console connects after recon has been running
- **THEN** it receives the current AP/client snapshot before any deltas
- **AND** subsequent changes arrive as incremental events
