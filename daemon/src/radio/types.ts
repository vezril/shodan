// Radio-control types (group 4). The radio is a single exclusive resource with a
// mode; multiple radios form a pool so conflicting modes can run on different
// cards (design D4/D8). Enumeration here reports the static facts about each
// radio; the mode and pool state live in the state machine (tasks 4.2–4.4).

export type RadioMode = "IDLE" | "RECON" | "CAPTURE" | "AP";

export interface RadioCapabilities {
  /** Can enter monitor mode (recon/capture). */
  monitor: boolean;
  /** Can inject frames (deauth/capture-assist). */
  injection: boolean;
  /** Can run as an access point (rogue AP / evil twin). */
  ap: boolean;
}

export interface RadioInfo {
  /** Interface name, e.g. "wlan0". */
  id: string;
  /** Underlying PHY, e.g. "phy0". */
  phy: string;
  /** Kernel driver, e.g. "mt76x2u". */
  driver: string;
  /** Human chipset label if known, e.g. "MediaTek MT7612U". */
  chipset: string | null;
  capabilities: RadioCapabilities;
}
