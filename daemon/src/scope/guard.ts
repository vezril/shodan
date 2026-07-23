import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// The engagement scope: the operator's own lab, as an allowlist of in-scope
// BSSIDs and/or SSIDs. Everything else is out-of-scope. Persisted to disk so it
// survives daemon restarts (design D6).
export interface Scope {
  bssids: string[];
  ssids: string[];
}

export interface ScopeTarget {
  bssid?: string | null;
  ssid?: string | null;
}

export type Authorization = { ok: true } | { ok: false; reason: string };

const EMPTY: Scope = { bssids: [], ssids: [] };

function normalize(input: Partial<Scope> | undefined): Scope {
  const clean = (value: unknown): string[] =>
    Array.isArray(value)
      ? [...new Set(value.filter((v): v is string => typeof v === "string" && v.length > 0))]
      : [];
  return { bssids: clean(input?.bssids), ssids: clean(input?.ssids) };
}

export class ScopeGuard {
  private scope: Scope = { ...EMPTY };

  constructor(private readonly file: string) {}

  /** Load persisted scope; a missing file means empty scope (observe-only). */
  async load(): Promise<void> {
    try {
      this.scope = normalize(JSON.parse(await readFile(this.file, "utf8")) as Partial<Scope>);
    } catch {
      this.scope = { ...EMPTY };
    }
  }

  getScope(): Scope {
    return { bssids: [...this.scope.bssids], ssids: [...this.scope.ssids] };
  }

  /** Replace and persist the scope. */
  async setScope(next: Partial<Scope> | undefined): Promise<Scope> {
    this.scope = normalize(next);
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify(this.scope, null, 2));
    return this.getScope();
  }

  /** Whether a target AP/client is inside the engagement scope. */
  isInScope(target: ScopeTarget): boolean {
    const bssid = target.bssid?.toLowerCase();
    if (bssid && this.scope.bssids.some((b) => b.toLowerCase() === bssid)) return true;
    if (target.ssid && this.scope.ssids.includes(target.ssid)) return true;
    return false;
  }

  /**
   * Gate for active operations (capture-with-injection, deauth, AP). Refused
   * unless the target is in scope — so with the observe-only default (empty
   * scope) every active operation is refused. Passive recon never calls this.
   * Future modules (later changes) call this before transmitting.
   */
  authorizeActive(operation: string, target: ScopeTarget): Authorization {
    if (this.isInScope(target)) return { ok: true };
    const label = target.ssid ?? target.bssid ?? "unknown target";
    return { ok: false, reason: `${operation} refused: ${label} is out of scope` };
  }
}
