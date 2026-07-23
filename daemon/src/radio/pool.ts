import { RadioController, type ModeApplier } from "./controller.js";
import type { RadioProvider } from "./provider.js";
import { RadioState } from "./state.js";
import type { RadioCapabilities, RadioInfo, RadioMode } from "./types.js";

/** No-op mode applier for dev; the real Linux reconfigure/teardown is task 4.5. */
export const noopApplier: ModeApplier = async () => {};

function capableOf(info: RadioInfo, mode: RadioMode): boolean {
  if (mode === "IDLE") return true;
  if (mode === "AP") return info.capabilities.ap;
  return info.capabilities.monitor; // RECON / CAPTURE
}

/** How versatile a radio is — used to keep the most-capable radios free. */
function capabilityCount(info: RadioInfo): number {
  const { monitor, injection, ap } = info.capabilities;
  return (monitor ? 1 : 0) + (injection ? 1 : 0) + (ap ? 1 : 0);
}

export interface RadioReport {
  id: string;
  phy: string;
  driver: string;
  chipset: string | null;
  capabilities: RadioCapabilities;
  mode: RadioMode;
}

export type ClaimResult = { ok: true; radioId: string } | { ok: false; reason: string };

// The radio pool (task 4.4). Built from the provider, it holds a controller per
// radio and reports per-radio capabilities + mode. Recon claims one idle
// monitor-capable radio and leaves the rest available, so conflicting modes run
// on distinct radios concurrently (design D4/D8). Claims are serialized so two
// concurrent claims can't select the same idle radio.
export class RadioPool {
  private controllers: RadioController[] = [];
  private claimQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly provider: RadioProvider,
    private readonly applier: ModeApplier = noopApplier,
  ) {}

  async init(): Promise<void> {
    const radios = await this.provider.enumerate();
    this.controllers = radios.map((r) => new RadioController(new RadioState(r), this.applier));
  }

  list(): RadioReport[] {
    return this.controllers.map((c) => ({
      id: c.info.id,
      phy: c.info.phy,
      driver: c.info.driver,
      chipset: c.info.chipset,
      capabilities: c.info.capabilities,
      mode: c.mode,
    }));
  }

  /** Claim one idle radio capable of `mode` and transition it. Serialized. */
  claim(mode: RadioMode): Promise<ClaimResult> {
    const run = this.claimQueue.then(async (): Promise<ClaimResult> => {
      // Prefer the least-capable sufficient radio, so versatile radios stay free
      // for modes that need them (e.g. keep the AP-capable card for AP).
      const candidate = this.controllers
        .filter((c) => c.mode === "IDLE" && capableOf(c.info, mode))
        .sort((a, b) => capabilityCount(a.info) - capabilityCount(b.info))[0];
      if (!candidate) return { ok: false, reason: `no idle radio can enter ${mode}` };
      const result = await candidate.transition(mode);
      return result.ok ? { ok: true, radioId: candidate.id } : { ok: false, reason: result.reason };
    });
    this.claimQueue = run.catch(() => undefined);
    return run;
  }

  /** Return a radio to IDLE. */
  async release(radioId: string): Promise<void> {
    const controller = this.controllers.find((c) => c.id === radioId);
    if (controller) await controller.transition("IDLE");
  }

  /** Safe teardown: return every radio to IDLE (leave monitor mode) on shutdown. */
  async releaseAll(): Promise<void> {
    await Promise.all(this.controllers.map((c) => c.transition("IDLE")));
  }
}
