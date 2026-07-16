# console-access

## ADDED Requirements

### Requirement: Loopback by default; guarded bind for wider access
The daemon SHALL bind to the loopback interface by default. It MUST NOT listen on
a routable interface without BOTH an explicit opt-in AND a configured auth token,
because it operates the radio with root privileges. There MUST NOT be any
unauthenticated listener on a routable interface.

#### Scenario: Default bind is loopback
- **WHEN** the daemon starts with default configuration
- **THEN** its API/stream is reachable on `127.0.0.1` only
- **AND** it is not reachable from another host on the LAN

#### Scenario: No accidental LAN exposure
- **WHEN** no explicit network-bind opt-in is configured
- **THEN** the daemon refuses to bind to a routable address

#### Scenario: Wider bind requires opt-in and a token
- **WHEN** a routable bind is opted into but no auth token is configured
- **THEN** the daemon refuses to start the routable listener
- **AND** WHEN both the opt-in and a token are configured, it binds and requires the token on every request

### Requirement: Multiple access modes
The daemon SHALL support reaching the console through (a) same-box localhost, (b)
a private tunnel (Tailscale or SSH) to the loopback listener, and (c) an opt-in
bind to a local interface for a nearby device. Tailscale is one supported remote
option, not the required path. Same-box local access SHALL work with no network
present, so an audit can be conducted in the field from the engine itself.

#### Scenario: Same-box field audit with no network
- **WHEN** the operator runs the console in a browser on the T470 with no network uplink
- **THEN** the console reaches the daemon on localhost and recon works

#### Scenario: Remote over a tunnel from the Mac
- **WHEN** the operator opens the console from the Mac through a Tailscale or SSH tunnel
- **THEN** the browser reaches the daemon's loopback listener on the T470
- **AND** no daemon port is published to the untrusted LAN

#### Scenario: Field audit from a nearby device
- **WHEN** the operator opts into a local-interface bind with an auth token configured
- **THEN** a nearby device can reach the console after presenting the token
- **AND** WHEN no token is configured, the daemon refuses the local-interface bind

### Requirement: Platform topology enforced
The system SHALL run the radio/engine on Linux only. The macOS host is supported
as a cockpit (browser) and development host, and MUST NOT be relied upon to run
the radio layer.

#### Scenario: Engine on Linux, cockpit on Mac
- **WHEN** the operator uses the console from macOS
- **THEN** the UI and development tooling run on macOS
- **AND** all radio operations execute on the Linux engine

#### Scenario: Development without hardware
- **WHEN** the stack runs on the macOS dev host with the mock adapter
- **THEN** the console is fully usable against synthetic recon data
- **AND** no radio operation is attempted on macOS
