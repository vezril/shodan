import type { ReconEvent, Snapshot } from "../contract.js";

/**
 * A recon engine behind a stable interface (design D2/D3). The mock adapter
 * (task 2.2) and the bettercap adapter (task 5) both implement it; the daemon
 * serves `snapshot()` to a client on connect, then forwards each subscribed
 * `ReconEvent` to that client's SSE stream (task 2.3).
 *
 * The UI depends only on this interface and the wire contract, never on the
 * engine — so swapping mock ↔ bettercap changes nothing above this seam.
 */
export interface ReconAdapter {
  /** Identifies the backing engine, e.g. "mock" or "bettercap" (logging/diagnostics). */
  readonly name: string;

  /** Begin recon (claim a radio, start scanning). Idempotent — safe to call when already running. */
  start(): Promise<void>;

  /** Stop recon and release resources. Idempotent — safe to call when already stopped. */
  stop(): Promise<void>;

  /** The full current inventory, delivered to a client on connect before any deltas. */
  snapshot(): Snapshot;

  /**
   * Subscribe to incremental deltas. Returns an unsubscribe function. Multiple
   * subscribers are supported — one per connected client — so fan-out is the
   * adapter's responsibility.
   */
  subscribe(listener: (event: ReconEvent) => void): () => void;
}
