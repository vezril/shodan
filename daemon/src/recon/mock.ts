import type {
  AccessPoint,
  Band,
  Client,
  Encryption,
  ReconEvent,
  Snapshot,
} from "@shodan/contract";
import type { ReconAdapter } from "./adapter.js";

// Synthetic recon source (task 2.2). Lets the whole stack run on a dev host with
// no radio (design D3). It seeds a small inventory, then on each tick applies one
// random mutation and emits the matching delta. `inScope` is always false here —
// the radio does not know scope; the scope-guard (task 6) stamps it.

export interface MockRadioAdapterOptions {
  /** Milliseconds between mutations. Default 1500. */
  tickMs?: number;
  /** APs to seed at start. Default 4. */
  seedAps?: number;
}

const SSID_POOL = [
  "lab-net",
  "Pineapple_Guest",
  "home-5G",
  "office-wifi",
  "IoT",
  "eduroam",
  null, // hidden SSID
];
const ENCRYPTIONS: Encryption[] = ["WPA2", "WPA2", "WPA3", "WPA2/WPA3", "OPEN"];
const CHANNELS_24 = [1, 6, 11];
const CHANNELS_5 = [36, 40, 44, 48, 149, 153, 157, 161];
const MAX_APS = 8;

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)] as T;
}
function randomMac(): string {
  return Array.from({ length: 6 }, () =>
    randInt(0, 255).toString(16).padStart(2, "0"),
  ).join(":");
}
function now(): string {
  return new Date().toISOString();
}
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export class MockRadioAdapter implements ReconAdapter {
  readonly name = "mock";

  private readonly tickMs: number;
  private readonly seedAps: number;
  private readonly aps = new Map<string, AccessPoint>();
  private readonly clients = new Map<string, Client>();
  private readonly listeners = new Set<(event: ReconEvent) => void>();
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(options: MockRadioAdapterOptions = {}) {
    this.tickMs = options.tickMs ?? 1500;
    this.seedAps = options.seedAps ?? 4;
  }

  async start(): Promise<void> {
    if (this.timer) return; // idempotent
    if (this.aps.size === 0) {
      for (let i = 0; i < this.seedAps; i++) this.spawnAp();
    }
    this.timer = setInterval(() => this.tick(), this.tickMs);
    this.timer.unref?.();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  snapshot(): Snapshot {
    return {
      type: "snapshot",
      at: now(),
      accessPoints: [...this.aps.values()],
      clients: [...this.clients.values()],
    };
  }

  subscribe(listener: (event: ReconEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: ReconEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  // --- mutations ---------------------------------------------------------

  private tick(): void {
    const roll = Math.random();
    if (roll < 0.35) this.driftApSignal();
    else if (roll < 0.55 && this.aps.size < MAX_APS) this.spawnAp();
    else if (roll < 0.7 && this.aps.size > 2) this.ageOutAp();
    else if (roll < 0.9) this.addClient();
    else this.dropClient();
  }

  private spawnAp(): void {
    const band: Band = Math.random() < 0.5 ? "2.4GHz" : "5GHz";
    const bssid = randomMac();
    const ap: AccessPoint = {
      bssid,
      ssid: pick(SSID_POOL),
      channel: band === "2.4GHz" ? pick(CHANNELS_24) : pick(CHANNELS_5),
      band,
      encryption: pick(ENCRYPTIONS),
      signalDbm: randInt(-85, -40),
      clientCount: 0,
      inScope: false,
      firstSeen: now(),
      lastSeen: now(),
    };
    this.aps.set(bssid, ap);
    this.emit({ type: "ap.upsert", ap });
  }

  private driftApSignal(): void {
    const ap = this.randomAp();
    if (!ap) return;
    const updated: AccessPoint = {
      ...ap,
      signalDbm: clamp(ap.signalDbm + randInt(-4, 4), -90, -30),
      lastSeen: now(),
    };
    this.aps.set(ap.bssid, updated);
    this.emit({ type: "ap.upsert", ap: updated });
  }

  private ageOutAp(): void {
    const ap = this.randomAp();
    if (!ap) return;
    for (const client of this.clients.values()) {
      if (client.bssid === ap.bssid) {
        this.clients.delete(client.mac);
        this.emit({ type: "client.remove", mac: client.mac });
      }
    }
    this.aps.delete(ap.bssid);
    this.emit({ type: "ap.remove", bssid: ap.bssid });
  }

  private addClient(): void {
    const ap = this.randomAp();
    if (!ap) return;
    const client: Client = {
      mac: randomMac(),
      bssid: ap.bssid,
      signalDbm: randInt(-85, -45),
      lastSeen: now(),
    };
    this.clients.set(client.mac, client);
    this.emit({ type: "client.upsert", client });
    this.bumpClientCount(ap.bssid);
  }

  private dropClient(): void {
    const client = this.randomClient();
    if (!client) return;
    this.clients.delete(client.mac);
    this.emit({ type: "client.remove", mac: client.mac });
    if (client.bssid) this.bumpClientCount(client.bssid);
  }

  private bumpClientCount(bssid: string): void {
    const ap = this.aps.get(bssid);
    if (!ap) return;
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.bssid === bssid) count++;
    }
    const updated: AccessPoint = { ...ap, clientCount: count, lastSeen: now() };
    this.aps.set(bssid, updated);
    this.emit({ type: "ap.upsert", ap: updated });
  }

  private randomAp(): AccessPoint | undefined {
    if (this.aps.size === 0) return undefined;
    return pick([...this.aps.values()]);
  }

  private randomClient(): Client | undefined {
    if (this.clients.size === 0) return undefined;
    return pick([...this.clients.values()]);
  }
}
