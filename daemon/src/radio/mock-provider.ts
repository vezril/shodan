import type { RadioProvider } from "./provider.js";
import type { RadioInfo } from "./types.js";

// A representative two-radio pool for dev on a host with no radio: the MK7AC
// (MT7612U, dual-band monitor + injection + AP) plus a cheap AR9271 (2.4 GHz
// monitor + injection, no AP) — enough for evil twin (design D8).
const MOCK_RADIOS: RadioInfo[] = [
  {
    id: "wlan0",
    phy: "phy0",
    driver: "mt76x2u",
    chipset: "MediaTek MT7612U (MK7AC)",
    capabilities: { monitor: true, injection: true, ap: true },
  },
  {
    id: "wlan1",
    phy: "phy1",
    driver: "ath9k_htc",
    chipset: "Atheros AR9271",
    capabilities: { monitor: true, injection: true, ap: false },
  },
];

export class MockRadioProvider implements RadioProvider {
  readonly name = "mock";

  constructor(private readonly radios: RadioInfo[] = MOCK_RADIOS) {}

  async enumerate(): Promise<RadioInfo[]> {
    // Return copies so callers can't mutate the fixture.
    return this.radios.map((r) => ({ ...r, capabilities: { ...r.capabilities } }));
  }
}
