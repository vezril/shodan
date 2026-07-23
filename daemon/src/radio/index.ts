import type { ModeApplier } from "./controller.js";
import { linuxModeApplier } from "./linux-applier.js";
import { LinuxRadioProvider } from "./linux-provider.js";
import { MockRadioProvider } from "./mock-provider.js";
import { noopApplier } from "./pool.js";
import type { RadioProvider } from "./provider.js";

export type { RadioProvider } from "./provider.js";
export { RadioPool, type ClaimResult, type RadioReport } from "./pool.js";
export type { RadioCapabilities, RadioInfo, RadioMode } from "./types.js";

// Real radios on Linux; the mock pool everywhere else (design D3: the radio
// layer is Linux-only, so a dev host runs against a representative fixture).
export function selectRadioProvider(platform: NodeJS.Platform = process.platform): RadioProvider {
  return platform === "linux" ? new LinuxRadioProvider() : new MockRadioProvider();
}

// Real reconfigure/teardown on Linux; a no-op on a dev host (no radio to touch).
export function selectModeApplier(platform: NodeJS.Platform = process.platform): ModeApplier {
  return platform === "linux" ? linuxModeApplier : noopApplier;
}
