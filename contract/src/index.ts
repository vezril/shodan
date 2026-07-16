// The daemon↔cockpit wire contract — the single source of truth for what the
// daemon streams to the UI.
//
// On connect the daemon sends one Snapshot (the full current inventory), then
// incremental ReconEvent deltas. Task 2.3 frames these over SSE; the mock
// adapter (task 2.2) produces them; the cockpit (tasks 3.x) consumes these same
// types — at which point this module graduates into a shared @shodan/contract
// package. Keeping it here now avoids standing up a third workspace before there
// is a second consumer.

export type Band = "2.4GHz" | "5GHz" | "6GHz";

export type Encryption =
  | "OPEN"
  | "WEP"
  | "WPA"
  | "WPA2"
  | "WPA3"
  | "WPA2/WPA3"
  | "UNKNOWN";

export interface AccessPoint {
  /** BSSID (the AP radio's MAC) — the stable key for upserts. */
  bssid: string;
  /** Network name; null for hidden/undisclosed SSIDs. */
  ssid: string | null;
  channel: number;
  band: Band;
  encryption: Encryption;
  /** Signal strength in dBm (negative, e.g. -52). */
  signalDbm: number;
  /** Stations currently observed associated with this AP. */
  clientCount: number;
  /**
   * Whether this AP is inside the engagement scope (scope-guard, task 6).
   * Observe-only default: false until a scope is defined.
   */
  inScope: boolean;
  /** ISO 8601 timestamps. */
  firstSeen: string;
  lastSeen: string;
}

export interface Client {
  /** Station MAC — the stable key for upserts. */
  mac: string;
  /** BSSID this station is associated with, or null if only probing. */
  bssid: string | null;
  signalDbm: number;
  /** ISO 8601 timestamp. */
  lastSeen: string;
}

/** Sent once when a client connects, before any deltas. */
export interface Snapshot {
  type: "snapshot";
  /** ISO 8601 timestamp the snapshot was taken. */
  at: string;
  accessPoints: AccessPoint[];
  clients: Client[];
}

/**
 * Incremental deltas after the snapshot. `upsert` covers both "new" and
 * "changed" so the UI updates a row in place (no duplicates); `remove` is emitted
 * when an AP/client ages out.
 */
export type ReconEvent =
  | { type: "ap.upsert"; ap: AccessPoint }
  | { type: "ap.remove"; bssid: string }
  | { type: "client.upsert"; client: Client }
  | { type: "client.remove"; mac: string };

/** Everything the daemon puts on the stream: the Snapshot first, then ReconEvents. */
export type StreamMessage = Snapshot | ReconEvent;

export function isSnapshot(msg: StreamMessage): msg is Snapshot {
  return msg.type === "snapshot";
}

export function isReconEvent(msg: StreamMessage): msg is ReconEvent {
  return msg.type !== "snapshot";
}
