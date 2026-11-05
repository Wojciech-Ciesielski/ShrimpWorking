// Część 1 Setup nad HTTP API Agamy (API v2, Leap 16.1 / Agama 24).
// Interfejs jest serwowany przez agama-web-server (--web-ui-dir), więc /api/* to ten sam origin,
// a token z nośnika (/run/agama/token) trafia do ciasteczka przez /login?token=… (robi to shrimp-setup).
import { LANGS, REGIONS, KEYBOARDS, WINDOWS_SPARE_GB, type Lang, type Region, type Keyboard } from "../data";
import { InstallError, type Disk, type InstallBackend, type InstallPlan, type Progress } from "./types";

const GB = 1e9;
const PRODUCT = { id: "Shrimp", mode: "immutable" };

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status}`);
  const t = await r.text();
  return (t ? JSON.parse(t) : null) as T;
}
const get = <T>(p: string) => call<T>("GET", p);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- typy odpowiedzi Agamy (tylko pola, których używamy) ---
interface ADevice {
  sid: number; name: string; description?: string; class?: string;
  block?: { size: number; systems?: string[]; shrinking?: { supported: boolean; minSize?: number } };
  drive?: { vendor?: string; model?: string };
  filesystem?: { type: string };
  partition?: { efi: boolean; id?: string };
  partitionTable?: { unusedSlots: { start: number; size: number }[] };
  partitions?: ADevice[];
}
interface ASystem {
  l10n?: { locales?: { id: string }[]; keymaps?: { id: string }[]; timezones?: { id: string }[] };
  storage?: { devices?: ADevice[]; candidateDrives?: number[] };
}
interface AStatus { stage: "configuring" | "installing" | "finished" | "failed"; progresses: { scope: string; index: number; size: number; step: string }[] }
interface AIssue { scope: string; class: string; description: string }

/** Dyski z systemu Agamy → dyski Setup. Czysta funkcja (testy w agama.test.ts). */
export function disksFromSystem(sys: ASystem): Disk[] {
  const devs = sys.storage?.devices || [];
  const cand = new Set(sys.storage?.candidateDrives || devs.map((d) => d.sid));
  return devs.filter((d) => cand.has(d.sid) && d.block).map((d) => {
    const sizeGB = Math.floor(d.block!.size / GB);
    const name = [d.drive?.vendor, d.drive?.model].filter(Boolean).join(" ").trim() || d.description || d.name;
    const parts = d.partitions || [];
    const win = parts
      .filter((p) => p.filesystem?.type === "ntfs" && (p.block?.systems || []).some((s) => /windows/i.test(s)))
      .sort((a, b) => (b.block?.size || 0) - (a.block?.size || 0))[0];
    const disk: Disk = { device: d.name, name, sizeGB };
    if (win && win.block) {
      const free = (d.partitionTable?.unusedSlots || []).reduce((s, u) => s + u.size, 0);
      const shrink = win.block.shrinking;
      const used = shrink?.supported && shrink.minSize ? shrink.minSize : win.block.size;
      disk.windows = {
        partition: win.name,
        minGB: Math.ceil(used / GB) + WINDOWS_SPARE_GB,
        poolGB: Math.floor((win.block.size + free) / GB),
      };
    }
    return disk;
  });
}

/** Plan Setup → konfiguracja Agamy (PUT /api/config). Czysta funkcja. */
export function configFromPlan(plan: InstallPlan, extra: { files?: unknown[]; scripts?: unknown } = {}) {
  const encryption = plan.diskPassword ? { luks2: { password: plan.diskPassword } } : undefined;
  const generate = { generate: { partitions: "default", ...(encryption ? { encryption } : {}) } };
  const partitions: unknown[] =
    plan.place === "beside" && plan.disk.windows
      ? [{ search: plan.disk.windows.partition, size: `${plan.windowsGB} GB` }, generate]
      : [{ search: "*", delete: true }, generate];
  return {
    product: PRODUCT,
    l10n: { locale: plan.locale, keymap: plan.keymap, timezone: plan.timezone },
    user: { fullName: plan.fullName, userName: plan.userName, password: plan.password, hashedPassword: false },
    storage: { drives: [{ search: plan.disk.device, partitions }] },
    ...extra,
  };
}

/** Faza instalacji po polsku na podstawie zakresu (scope) postępu Agamy. */
export function phaseOf(st: AStatus): { percent: number; phase: string } {
  const p = st.progresses.find((x) => x.scope === "manager") || st.progresses[0];
  const sub = st.progresses.find((x) => x.scope !== "manager");
  const scope = sub?.scope || p?.scope || "storage";
  const phase = scope === "storage" ? "Przygotowanie dysku" : scope === "software" ? "Instalowanie systemu" : "Przywracanie plików";
  let percent = 0;
  if (p && p.size > 0) {
    const inner = sub && sub !== p && sub.size > 0 ? sub.index / sub.size : 0;
    percent = Math.min(99, ((p.index - 1 + inner) / p.size) * 100);
  }
  return { percent: Math.max(0, percent), phase };
}

/** Plik przekazywany do pierwszego uruchomienia (czyta go shrimp-setup --first-boot). */
function handoff(plan: InstallPlan) {
  return {
    destination: "/var/lib/shrimp-setup/install.json",
    permissions: "0644",
    content: JSON.stringify({ fullName: plan.fullName, userName: plan.userName, beside: plan.place === "beside" }),
  };
}

export class AgamaBackend implements InstallBackend {
  private sys: Promise<ASystem> | null = null;
  private system() { return (this.sys ||= get<ASystem>("/api/system")); }

  async languages(): Promise<Lang[]> {
    const ids = new Set(((await this.system()).l10n?.locales || []).map((l) => l.id));
    return ids.size ? LANGS.filter((l) => ids.has(l.locale)) : LANGS;
  }
  async regions(): Promise<Region[]> {
    const ids = new Set(((await this.system()).l10n?.timezones || []).map((t) => t.id));
    return ids.size ? REGIONS.filter((r) => ids.has(r.tz)) : REGIONS;
  }
  async keyboards(): Promise<Keyboard[]> {
    const ids = new Set(((await this.system()).l10n?.keymaps || []).map((k) => k.id));
    return ids.size ? KEYBOARDS.filter((k) => ids.has(k.keymap)) : KEYBOARDS;
  }
  async disks(): Promise<Disk[]> { return disksFromSystem(await this.system()); }

  async setLanguage(locale: string) {
    await call("POST", "/api/action", { configureL10n: { locale } });
  }
  async setKeymap(keymap: string) {
    await call("POST", "/api/action", { configureL10n: { keymap } });
  }

  /** Czeka, aż Agama przeliczy propozycję po zmianie konfiguracji. */
  private async settle() {
    for (let i = 0; i < 120; i++) {
      const st = await get<AStatus>("/api/status");
      if (!st.progresses.length) return;
      await sleep(500);
    }
  }

  async check(plan: InstallPlan) {
    await call("PUT", "/api/config", configFromPlan(plan));
    await this.settle();
    const issues = await get<AIssue[]>("/api/issues");
    const storage = issues.filter((i) => i.scope === "storage");
    if (storage.length) throw new InstallError("space", storage.map((i) => i.description).join("; "));
    if (issues.length) throw new InstallError("install", issues.map((i) => i.description).join("; "));
  }

  async install(plan: InstallPlan, onProgress: (p: Progress) => void) {
    await call("PUT", "/api/config", configFromPlan(plan, {
      files: [handoff(plan)],
      scripts: { post: [{ name: "shrimp-post-install", chroot: false, url: "file:///usr/share/shrimp-setup/post-install.sh" }] },
    }));
    await this.settle();
    await call("POST", "/api/action", { install: null });
    const t0 = Date.now();
    for (;;) {
      await sleep(1000);
      const st = await get<AStatus>("/api/status");
      if (st.stage === "failed") throw new InstallError("install");
      if (st.stage === "finished") { onProgress({ percent: 100, phase: "Gotowe" }); return; }
      const { percent, phase } = phaseOf(st);
      const el = (Date.now() - t0) / 60000;
      const etaMin = percent > 3 ? Math.max(1, Math.ceil((el / percent) * (100 - percent))) : 11;
      onProgress({ percent, phase, etaMin });
    }
  }

  async reboot() { await call("POST", "/api/action", { finish: "reboot" }); }
}
