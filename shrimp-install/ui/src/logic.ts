// Czyste funkcje interfejsu (bez DOM), testowane w logic.test.ts.
import type { Device, Phase, Progress } from "./backend/types";

export const GiB = 1024 ** 3;
const MiB = 1024 ** 2;

/** Szacunkowe prędkości, zanim program zmierzy prawdziwe (B/s). */
export const EST = { download: 14 * MiB, write: 38 * MiB, copy: 52 * MiB };

const dec = (n: number, d = 1) => n.toFixed(d).replace(".", ",");

/** 29,8 GB · 465 GB · 1 TB (jednostki binarne, jak w Eksploratorze). */
export function fmtGB(bytes: number): string {
  const g = bytes / GiB;
  if (g >= 1000) {
    const t = g / 1024;
    return (t < 10 ? dec(t).replace(/,0$/, "") : Math.round(t).toString()) + " TB";
  }
  return (g >= 100 ? Math.round(g).toString() : dec(g)) + " GB";
}

/** Rozmiar pliku lub folderu: małe w MB. */
export function fmtSize(bytes: number): string {
  return bytes < 0.1 * GiB ? Math.max(1, Math.round(bytes / MiB)) + " MB" : dec(bytes / GiB) + " GB";
}

export function dur(sec: number): string {
  if (sec < 45) return "mniej niż minuta";
  const m = Math.max(1, Math.round(sec / 60));
  return m === 1 ? "około minuty" : `około ${m} min`;
}

export const mbps = (bps: number) => Math.max(1, Math.round(bps / MiB)) + " MB/s";

export const deviceLabel = (d: Device) => `${d.name} · ${fmtGB(d.size)}`;

export interface Space { shrPct: number; filesPct: number; text: string; over: boolean }

/** Pasek „Miejsce na nośniku”: Shrimp + kopia plików na nośniku o pojemności cap. */
export function space(cap: number, shrimp: number, files: number): Space {
  const free = cap - shrimp, left = free - files, over = left < 0;
  return {
    shrPct: Math.min(100, (shrimp / cap) * 100),
    filesPct: Math.max(0, (Math.min(files, Math.max(0, free)) / cap) * 100),
    text: over ? `Brakuje ${dec((-left) / GiB)} GB` : `Wolne ${dec(Math.max(0, left) / GiB)} GB z ${dec(cap / GiB)} GB`,
    over,
  };
}

/** Pozostały czas całości: bieżąca faza z pomiaru, kolejne z szacunku. */
export function remaining(p: Progress, sizes: { shrimp: number; files: number }): number {
  const left = Math.max(0, p.total - p.done);
  const est = [0, EST.download, EST.write, EST.copy];
  let s = left / (p.speed || est[p.phase]);
  if (p.phase < 2) s += sizes.shrimp / EST.write;
  if (p.phase < 3) s += sizes.files / EST.copy;
  return s;
}

/** Opis jednej fazy pod jej nazwą (jak w makiecie). */
export function phaseText(n: Phase, cur: Progress | null, sizes: { shrimp: number; files: number }, finished: boolean): string {
  const at = finished ? 4 : cur ? cur.phase : 1;
  const left = (p: Progress) => dur(Math.max(0, p.total - p.done) / (p.speed || [0, EST.download, EST.write, EST.copy][p.phase]));
  const of = (p: Progress) => `${dec(p.done / GiB)} z ${dec(p.total / GiB)} GB`;
  if (n === 1) {
    if (at > 1) return `Pobrano ${dec(sizes.shrimp / GiB)} GB`;
    if (!cur || !cur.total) return "Łączenie…";
    return `${of(cur)} · ${mbps(cur.speed || EST.download)} · zostało ${left(cur)}`;
  }
  if (n === 2) {
    if (at > 2) return "Zapisano";
    if (at < 2 || !cur) return `Zajmie ${dur(sizes.shrimp / EST.write)}`;
    const pct = cur.total ? Math.round((cur.done / cur.total) * 100) : 0;
    return `${pct}% · ${mbps(cur.speed || EST.write)} · zostało ${left(cur)}`;
  }
  if (!sizes.files) return at > 3 ? "Nie wybrano plików" : "Nic do skopiowania";
  if (at > 3) return `Skopiowano ${fmtSize(sizes.files)}`;
  if (at < 3 || !cur) return `${fmtSize(sizes.files)} · zajmie ${dur(sizes.files / EST.copy)}`;
  return `${of(cur)} · ${mbps(cur.speed || EST.copy)} · zostało ${left(cur)}`;
}

/** Ułamek ukończenia fazy n (0–1) dla paska. */
export function phaseFrac(n: Phase, cur: Progress | null, finished: boolean): number {
  if (finished) return 1;
  const at = cur ? cur.phase : 1;
  if (n < at) return 1;
  if (n > at || !cur || !cur.total) return 0;
  return Math.min(1, cur.done / cur.total);
}
