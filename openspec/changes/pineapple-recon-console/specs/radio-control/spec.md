# radio-control

## ADDED Requirements

### Requirement: Radio enumeration and capability report
The daemon SHALL enumerate available wireless interfaces and report, for the
MK7AC (MT7612U), whether monitor mode and the required interface combinations
are available, so the operator knows the radio is usable before starting recon.

#### Scenario: Usable radio detected
- **WHEN** the daemon starts with the MK7AC connected
- **THEN** it reports the interface, its chipset/driver, and monitor-mode availability

#### Scenario: No usable radio
- **WHEN** no monitor-capable interface is present
- **THEN** the daemon reports the radio as unavailable with a human-readable reason
- **AND** does not attempt to start recon

### Requirement: Exclusive radio mode state machine
The daemon SHALL model the radio as a single resource with exactly one active
mode at a time (`IDLE`, `RECON`, and reserved `CAPTURE`/`AP` states). It MUST
serialize mode transitions and MUST reject a request that conflicts with the
active mode, returning the conflicting mode as the reason.

#### Scenario: Start recon from idle
- **WHEN** the radio is `IDLE` and the operator starts recon
- **THEN** the daemon transitions the radio to `RECON` and begins channel hopping

#### Scenario: Conflicting request is refused
- **WHEN** the radio is in `RECON` and a request requires a conflicting mode
- **THEN** the daemon refuses the request
- **AND** returns that the radio is currently in `RECON`

### Requirement: Safe teardown
When recon stops or the daemon shuts down, it SHALL restore the interface to a
clean state (leave monitor mode / release the interface) so the radio is not
left stuck.

#### Scenario: Stopping recon restores the interface
- **WHEN** the operator stops recon
- **THEN** the daemon tears down monitor mode and returns the radio to `IDLE`

### Requirement: Radio pool with per-radio capabilities
The daemon SHALL treat radios as a pool and report each radio's capabilities
(monitor, injection, AP). When multiple radios are present it MAY assign
different modes to different radios concurrently. Recon SHALL claim one selected
monitor-capable radio and leave the others available.

#### Scenario: Multiple radios enumerated with capabilities
- **WHEN** several radios are connected
- **THEN** the daemon lists each radio with its monitor / injection / AP capability

#### Scenario: Recon claims one radio, others stay available
- **WHEN** recon starts and multiple radios are present
- **THEN** recon claims one monitor-capable radio
- **AND** the remaining radios stay available for other modes

#### Scenario: Conflicting modes run concurrently on distinct radios
- **WHEN** two radios are present and two modes that would conflict on one radio are requested
- **THEN** the daemon MAY run each mode on a separate radio at the same time
