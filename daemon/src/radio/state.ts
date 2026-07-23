import type { RadioInfo, RadioMode } from "./types.js";

export type TransitionResult = { ok: true } | { ok: false; reason: string };

// The per-radio mode state machine (task 4.2). A radio holds exactly one active
// mode. Entering an active mode (RECON/CAPTURE/AP) requires the radio to be IDLE
// first — you stop before switching — and requires the matching capability.
// Returning to IDLE (stop/teardown) is always allowed. Only IDLE and RECON are
// exercised in this change; CAPTURE and AP are reserved for later groups.
export class RadioState {
  private currentMode: RadioMode = "IDLE";

  constructor(readonly info: RadioInfo) {}

  get id(): string {
    return this.info.id;
  }

  get mode(): RadioMode {
    return this.currentMode;
  }

  /** Whether entering `mode` is legal right now, with a reason if not. */
  canEnter(mode: RadioMode): TransitionResult {
    if (mode === "IDLE") return { ok: true };
    if (this.currentMode === mode) return { ok: true }; // idempotent re-enter
    if (this.currentMode !== "IDLE") {
      return { ok: false, reason: `radio ${this.id} is in ${this.currentMode}` };
    }
    const caps = this.info.capabilities;
    if ((mode === "RECON" || mode === "CAPTURE") && !caps.monitor) {
      return { ok: false, reason: `radio ${this.id} cannot enter ${mode}: no monitor mode` };
    }
    if (mode === "AP" && !caps.ap) {
      return { ok: false, reason: `radio ${this.id} cannot enter AP: no AP support` };
    }
    return { ok: true };
  }

  /** Apply a transition if legal; returns the same result as canEnter. */
  transition(mode: RadioMode): TransitionResult {
    const check = this.canEnter(mode);
    if (check.ok) this.currentMode = mode;
    return check;
  }
}
