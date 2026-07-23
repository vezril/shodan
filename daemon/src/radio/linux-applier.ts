import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ModeApplier } from "./controller.js";

const run = promisify(exec);

// Reconfigure an interface for a mode by cycling it down, setting the type, and
// bringing it back up. Root + Linux. Verification is deferred to the T470.
async function setType(id: string, type: "monitor" | "managed"): Promise<void> {
  await run(`ip link set ${id} down`);
  await run(`iw dev ${id} set type ${type}`);
  await run(`ip link set ${id} up`);
}

// Real mode applier (Linux, root). RECON/CAPTURE put the interface into monitor
// mode; IDLE tears it back down to managed (safe teardown — the interface is
// never left stuck in monitor). AP is stood up by hostapd in a later group.
export const linuxModeApplier: ModeApplier = async (radio, _from, to) => {
  switch (to) {
    case "RECON":
    case "CAPTURE":
      await setType(radio.id, "monitor");
      return;
    case "IDLE":
      await setType(radio.id, "managed");
      return;
    case "AP":
      return;
  }
};
