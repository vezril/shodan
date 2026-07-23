import { LinuxRadioProvider } from "./linux-provider.js";
import { MockRadioProvider } from "./mock-provider.js";
import type { RadioProvider } from "./provider.js";

export type { RadioProvider } from "./provider.js";
export { RadioPool, type ClaimResult, type RadioReport } from "./pool.js";
export type { RadioCapabilities, RadioInfo, RadioMode } from "./types.js";

// Real radios on Linux; the mock pool everywhere else (design D3: the radio
// layer is Linux-only, so a dev host runs against a representative fixture).
export function selectRadioProvider(platform: NodeJS.Platform = process.platform): RadioProvider {
  return platform === "linux" ? new LinuxRadioProvider() : new MockRadioProvider();
}
