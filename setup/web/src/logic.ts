// Czyste funkcje Setup (testy: logic.test.ts).
import { APPS, WIN_MATCH, KLID_XKB, LANGID_XKB, TZ_ALIAS, DEFAULT_TZ, type WinApp, type Lang, type Region, type Keyboard } from "./data";
import type { Transfer } from "./backend/types";

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

/**
 * Programy z shrimp.json (nazwy z listy programów Windows i pakiety Microsoft Store) → odpowiedniki z Flathub,
 * w kolejności WIN_MATCH, bez powtórzeń. Nieznane pomijamy.
 */
export function mapWindowsApps(names: string[], store: string[] = []): WinApp[] {
  const out: WinApp[] = [];
  for (const m of WIN_MATCH) {
    if (out.some((a) => a.id === m.id)) continue;
    if (names.some((n) => m.re.test(n.trim())) || (m.store && store.some((s) => m.store!.test(s)))) out.push({ windows: m.windows, name: m.name, id: m.id });
  }
  return out;
}

/** Układ Windows (KLID, np. „00000415”) → xkb, jeśli Setup go zna. */
export function klidToXkb(klid: string, known: string[]): string | null {
  const k = klid.toLowerCase();
  const x = KLID_XKB[k] || (/^0000/.test(k) ? LANGID_XKB[k.slice(4)] : undefined);
  return x && known.includes(x) ? x : null;
}

export interface Prefill { lang: number; region: number; kb: number; full: string; user: string }

/** Wartości kroków 1–6 z Shrimp Install. -1: brak podpowiedzi (zostaje domyślna). */
export function prefill(t: Transfer, langs: Lang[], regs: Region[], kbs: Keyboard[]): Prefill {
  const lc = (t.locale?.language || t.locale?.format || "").replace("-", "_");
  let lang = lc ? langs.findIndex((l) => l.locale.startsWith(lc + ".")) : -1;
  if (lang < 0 && lc) lang = langs.findIndex((l) => l.locale.startsWith(lc.split("_")[0] + "_"));
  const tz = t.locale?.timezone ? TZ_ALIAS[t.locale.timezone] || t.locale.timezone : lang >= 0 ? DEFAULT_TZ[langs[lang].locale.split(".")[0]] : undefined;
  const region = tz ? regs.findIndex((r) => r.tz === tz) : -1;
  const keys = kbs.map((k) => k.keymap);
  const x = (t.locale?.keyboards || []).map((k) => klidToXkb(k, keys)).find((k) => k);
  const kb = x ? keys.indexOf(x) : -1;
  const full = (t.user?.fullName || "").trim();
  const user = slug(t.user?.name || "") || slug(firstName(full, ""));
  return { lang, region, kb, full, user };
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
