import { exec } from "node:child_process";
import { readlink } from "node:fs/promises";
import { basename } from "node:path";
import { promisify } from "node:util";
import type { RadioProvider } from "./provider.js";
import type { RadioCapabilities, RadioInfo } from "./types.js";

const run = promisify(exec);

// Real radio enumeration via `iw` (Linux only). Verification is deferred to the
// T470 — this host has no monitor-mode driver. The mock provider covers dev.
export class LinuxRadioProvider implements RadioProvider {
  readonly name = "linux";

  async enumerate(): Promise<RadioInfo[]> {
    const { stdout } = await run("iw dev");
    const interfaces = parseIwDev(stdout);
    const radios: RadioInfo[] = [];
    for (const iface of interfaces) {
      radios.push({
        id: iface.id,
        phy: iface.phy,
        driver: await this.driver(iface.id),
        chipset: null,
        capabilities: await this.capabilities(iface.phy),
      });
    }
    return radios;
  }

  private async capabilities(phy: string): Promise<RadioCapabilities> {
    const { stdout } = await run(`iw phy ${phy} info`);
    const modes = parseSupportedModes(stdout);
    const monitor = modes.has("monitor");
    // `iw` does not report injection directly; infer it from monitor support.
    return { monitor, injection: monitor, ap: modes.has("AP") };
  }

  private async driver(id: string): Promise<string> {
    try {
      return basename(await readlink(`/sys/class/net/${id}/device/driver`));
    } catch {
      return "unknown";
    }
  }
}

export function parseIwDev(out: string): { id: string; phy: string }[] {
  const result: { id: string; phy: string }[] = [];
  let currentPhy = "";
  for (const line of out.split("\n")) {
    const phyMatch = line.match(/^phy#(\d+)/);
    if (phyMatch) {
      currentPhy = `phy${phyMatch[1]}`;
      continue;
    }
    const ifMatch = line.match(/^\s*Interface\s+(\S+)/);
    if (ifMatch && currentPhy) result.push({ id: ifMatch[1], phy: currentPhy });
  }
  return result;
}

export function parseSupportedModes(out: string): Set<string> {
  const modes = new Set<string>();
  let inSection = false;
  for (const line of out.split("\n")) {
    if (/Supported interface modes:/.test(line)) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;
    const bullet = line.match(/^\s*\*\s*(\S+)/);
    if (bullet?.[1]) modes.add(bullet[1]);
    else if (line.trim() !== "") break; // next section → done
  }
  return modes;
}
