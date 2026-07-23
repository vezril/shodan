import { RadioState, type TransitionResult } from "./state.js";
import type { RadioInfo, RadioMode } from "./types.js";

/**
 * Applies a real mode change to the radio (e.g. put the interface into monitor
 * mode, or tear it down). Async and Linux-specific; the mock applier is a no-op.
 * Task 4.5 provides the real teardown/reconfigure.
 */
export type ModeApplier = (radio: RadioInfo, from: RadioMode, to: RadioMode) => Promise<void>;

// Serializes async mode transitions for one radio (task 4.3). Requests are
// chained through a mutex so they run one-at-a-time; each request's validity is
// re-checked only after the previous transition has fully applied, so two
// concurrent callers can't both observe IDLE and both proceed. A conflicting
// request is refused with the active mode as the reason.
export class RadioController {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly state: RadioState,
    private readonly apply: ModeApplier,
  ) {}

  get id(): string {
    return this.state.id;
  }

  get mode(): RadioMode {
    return this.state.mode;
  }

  get info(): RadioInfo {
    return this.state.info;
  }

  transition(mode: RadioMode): Promise<TransitionResult> {
    const run = this.queue.then(async (): Promise<TransitionResult> => {
      const check = this.state.canEnter(mode);
      if (!check.ok) return check;
      if (this.state.mode === mode) return { ok: true }; // already there
      try {
        await this.apply(this.state.info, this.state.mode, mode);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, reason: `radio ${this.id} failed to enter ${mode}: ${message}` };
      }
      this.state.transition(mode);
      return { ok: true };
    });
    // Keep the queue alive regardless of this transition's outcome.
    this.queue = run.catch(() => undefined);
    return run;
  }
}
