// Język Setup: tłumaczenia w i18n/setup, ładowane na żądanie (jeden plik na język), bo języków jest ponad sto.
import { build, negotiate, type I18n } from "../../../i18n/core";
import keys from "../../../i18n/setup/_keys.tsv?raw";

const files = import.meta.glob("../../../i18n/setup/*.txt", { query: "?raw", import: "default" }) as Record<string, () => Promise<string>>;
const byTag = new Map(Object.entries(files).map(([path, load]) => [/([^/]+)\.txt$/.exec(path)![1], load]));

/** Tłumacz dla pierwszego z żądanych języków, który mamy (bez dopasowania: angielski). */
export async function load(requested: string[]): Promise<I18n> {
  const tag = negotiate(requested);
  const f = byTag.get(tag);
  let txt: string | undefined;
  try { txt = f ? await f() : undefined; } catch { /* brak pliku: angielski */ }
  return build(keys, tag, txt);
}

/** Język startowy: ?lang= z adresu, potem języki przeglądarki (system nośnika). */
export function requestedLanguages(q: URLSearchParams): string[] {
  const forced = q.get("lang");
  return [...(forced ? [forced] : []), ...(navigator.languages || [])];
}
