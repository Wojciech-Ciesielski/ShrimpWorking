// Czyste funkcje Setup (testy: logic.test.ts).
import { APPS, WIN_EQUIV, type WinApp } from "./data";

export const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Pierwsze słowo imienia i nazwiska („Cześć, Anna”). */
export function firstName(full: string, fallback = "tam") { return full.trim().split(/\s+/)[0] || fallback; }

/** Nazwa użytkownika z imienia: małe litery, bez polskich znaków. */
export function slug(s: string) {
  return s.toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
}

export function tnow(z: string) {
  try { return new Intl.DateTimeFormat("pl-PL", { timeZone: z, hour: "2-digit", minute: "2-digit" }).format(new Date()); } catch { return ""; }
}

export interface Pick { key: string; id: string; label: string }

/** „Twoje programy z Windows”: maks. 5 pozycji; inny odpowiednik jako „A → B”. */
export function windowsList(apps: WinApp[] | null): Pick[] {
  return (apps || []).slice(0, 5).map((a) => ({
    key: "w:" + a.windows,
    id: a.id,
    label: a.windows === a.name ? esc(a.name) : esc(a.windows) + '<span class="arr">→</span>' + esc(a.name),
  }));
}

/** Programy z listy Shrimp Install (plik JSON) → odpowiedniki z Flathub. Nieznane pomijamy. */
export function mapWindowsApps(names: string[]): WinApp[] {
  return names.filter((n) => WIN_EQUIV[n]).map((n) => ({ windows: n, ...WIN_EQUIV[n] }));
}

/** „Proponowane programy”: maks. 5, po jednym z każdej wybranej kategorii na zmianę, bez duplikatów i bez tych z Windows. */
export function proposals(use: boolean[], winApps: WinApp[] | null): Pick[] {
  const out: Pick[] = [];
  const seen = new Set((winApps || []).slice(0, 5).map((a) => a.id));
  const sel = use.map((u, i) => (u ? i : -1)).filter((i) => i >= 0);
  for (let r = 0, any = true; any && out.length < 5; r++) {
    any = false;
    for (const i of sel) {
      const a = APPS[i][r];
      if (!a) continue;
      any = true;
      if (!seen.has(a.id) && out.length < 5) { seen.add(a.id); out.push({ key: a.id, id: a.id, label: `${esc(a.name)} <span class="meta">${esc(a.what)}</span>` }); }
    }
  }
  return out;
}
