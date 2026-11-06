// Czyste funkcje Setup (testy: logic.test.ts).
import { resolveTag, type I18n } from "../../../i18n/core";
import { APPS, WIN_CATALOG_ORDERED, KLID_XKB, LANGID_XKB, TZ_ALIAS, defaultTz, type WinApp, type Lang, type Region, type Keyboard } from "./data";
import type { Transfer } from "./backend/types";

export const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Pierwsze słowo imienia i nazwiska („Cześć, Anna”). */
export function firstName(full: string, fallback = "") { return full.trim().split(/\s+/)[0] || fallback; }

/** Nazwa użytkownika z imienia: małe litery, bez polskich znaków. */
export function slug(s: string) {
  const map: Record<string, string> = { ł: "l", ø: "o", đ: "d", ð: "d", ß: "ss", æ: "ae", œ: "oe", ı: "i", þ: "th" };
  return s.toLowerCase().replace(/[łøđðßæœıþ]/g, (c) => map[c]).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
}

/** Godzina w strefie, w formacie języka interfejsu. */
export function tnow(L: I18n, z: string) {
  try { return new Intl.DateTimeFormat(L.locale, { timeZone: z, hour: "2-digit", minute: "2-digit" }).format(new Date()); } catch { return ""; }
}

const names = (L: I18n, type: "region" | "language") => { try { return new Intl.DisplayNames([L.locale], { type, fallback: "code" }); } catch { return null; } };

/** „Polska”, „Stany Zjednoczone · Nowy Jork”: kraj z Intl, miasto z tłumaczeń. */
export function regionLabel(L: I18n, r: Region): string {
  const country = names(L, "region")?.of(r.code) || r.code;
  return r.city ? `${country} · ${L.t("city." + r.city)}` : country;
}

/** Nazwa strefy czasowej w języku interfejsu („czas środkowoeuropejski standardowy”). */
export function zoneName(L: I18n, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat(L.locale, { timeZone: tz, timeZoneName: "long" }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value || tz.replace(/_/g, " ");
  } catch { return tz.replace(/_/g, " "); }
}

/** „Polski (programisty)”, „angielski (Stany Zjednoczone)”: język i kraj z Intl, wariant z tłumaczeń. */
export function keyboardName(L: I18n, k: Keyboard): string {
  const lang = names(L, "language")?.of(k.lang) || k.lang;
  const extra = [k.region ? names(L, "region")?.of(k.region) || k.region : "", k.note ? L.t(k.note) : ""].filter(Boolean).join(", ");
  return (lang.charAt(0).toLocaleUpperCase(L.locale) + lang.slice(1)) + (extra ? ` (${extra})` : "");
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
 * najpierw 100 najpopularniejszych (pole `top`), potem w kolejności katalogu (windows-apps.json), bez powtórzeń. Pomijamy nieznane, wpisy bez odpowiednika
 * i odpowiedniki, które system ma od razu.
 */
export function mapWindowsApps(names: string[], store: string[] = []): WinApp[] {
  const out: WinApp[] = [];
  for (const m of WIN_CATALOG_ORDERED) {
    if (!m.linux || m.base || out.some((a) => a.id === m.linux!.id)) continue;
    if (names.some((n) => m.re.test(n.trim())) || (m.store && store.some((s) => m.store!.test(s)))) out.push({ windows: m.windows, name: m.linux.name, id: m.linux.id });
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
  const raw = t.locale?.language || t.locale?.format || "";
  const lc = raw.replace("-", "_");
  let lang = lc ? langs.findIndex((l) => l.locale.startsWith(lc + ".")) : -1;
  if (lang < 0 && raw) {
    // Inny zapis (sr-Latn-RS, zh-Hant-TW) albo język bez tego kraju: najlepsze dopasowanie z listy języków GNOME.
    const tag = resolveTag(raw), country = /[-_]([A-Za-z]{2})\b/.exec(raw)?.[1]?.toUpperCase();
    if (tag) {
      lang = langs.findIndex((l) => l.tag === tag && country && l.locale.split(/[.@]/)[0].endsWith("_" + country));
      if (lang < 0) lang = langs.findIndex((l) => l.tag === tag);
    }
  }
  const tz = t.locale?.timezone ? TZ_ALIAS[t.locale.timezone] || t.locale.timezone : lang >= 0 ? defaultTz(langs[lang].locale) : undefined;
  const region = tz ? regs.findIndex((r) => r.tz === tz) : -1;
  const keys = kbs.map((k) => k.keymap);
  const x = (t.locale?.keyboards || []).map((k) => klidToXkb(k, keys)).find((k) => k);
  const kb = x ? keys.indexOf(x) : -1;
  const full = (t.user?.fullName || "").trim();
  const user = slug(t.user?.name || "") || slug(firstName(full, ""));
  return { lang, region, kb, full, user };
}

/** „Proponowane programy”: maks. 5, po jednym z każdej wybranej kategorii na zmianę, bez duplikatów i bez tych z Windows. */
export function proposals(L: I18n, use: boolean[], winApps: WinApp[] | null): Pick[] {
  const out: Pick[] = [];
  const seen = new Set((winApps || []).slice(0, 5).map((a) => a.id));
  const sel = use.map((u, i) => (u ? i : -1)).filter((i) => i >= 0);
  for (let r = 0, any = true; any && out.length < 5; r++) {
    any = false;
    for (const i of sel) {
      const a = APPS[i][r];
      if (!a) continue;
      any = true;
      if (!seen.has(a.id) && out.length < 5) { seen.add(a.id); out.push({ key: a.id, id: a.id, label: `${esc(a.name)} <span class="meta">${esc(L.t(a.what))}</span>` }); }
    }
  }
  return out;
}
