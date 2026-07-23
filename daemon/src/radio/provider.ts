import type { RadioInfo } from "./types.js";

/**
 * Enumerates the WiFi radios available to the daemon and reports each one's
 * capabilities. The Linux provider reads real interfaces via `iw`; the mock
 * provider returns a representative pool so the daemon runs on a dev host with
 * no radio (mirrors the ReconAdapter split, design D3).
 */
export interface RadioProvider {
  /** Identifies the backing provider, e.g. "linux" or "mock". */
  readonly name: string;

  /** Enumerate the radios and their capabilities. */
  enumerate(): Promise<RadioInfo[]>;
}
