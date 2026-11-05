// Język interfejsu: wykryty w Windows (program przekazuje listę języków), z możliwością wymuszenia (?lang=, --lang).
import { createI18n, type I18n } from "../../../i18n/core";
import keys from "../../../i18n/install/_keys.tsv?raw";

const files = import.meta.glob("../../../i18n/install/*.txt", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export const load = (requested: string[]): I18n => createI18n(keys, files, requested);

/** Język z adresu (?lang=de), ustawień programu (window.SHRIMP_OPTS.langs) albo przeglądarki. */
export function requestedLanguages(q: URLSearchParams, opt: { lang?: string; langs?: string[] }): string[] {
  const forced = q.get("lang") || opt.lang;
  return [...(forced ? [forced] : []), ...(opt.langs || []), ...(navigator.languages || [])];
}
