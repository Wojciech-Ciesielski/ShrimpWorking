import type { Lang, Region, Keyboard, WinApp } from "../data";

/** Dysk, na którym można zainstalować Shrimp. Rozmiary w GB (10^9, jak na etykietach dysków). */
export interface Disk {
  /** Nazwa urządzenia, np. /dev/nvme0n1. */
  device: string;
  /** Nazwa dla ludzi, np. „Samsung SSD 980”. */
  name: string;
  sizeGB: number;
  /** Windows na tym dysku, jeśli jest. */
  windows?: {
    /** Partycja systemowa Windows (NTFS), którą zmniejszamy przy instalacji „obok”. */
    partition: string;
    /** Najmniejszy rozmiar Windows: zajęte miejsce + zapas. */
    minGB: number;
    /** Miejsce, które dzielimy suwakiem: partycja Windows + wolne miejsce na dysku. */
    poolGB: number;
  };
}

export type Place = "beside" | "replace" | "whole";

/** Wszystko, co zebrały kroki 1–7. */
export interface InstallPlan {
  locale: string;
  timezone: string;
  keymap: string;
  disk: Disk;
  place: Place;
  /** Rozmiar Windows po zmniejszeniu (tylko „beside”). */
  windowsGB?: number;
  /** Hasło szyfrowania dysku (LUKS2) albo brak. */
  diskPassword?: string;
  fullName: string;
  userName: string;
  password: string;
}

export interface Progress {
  /** 0–100. */
  percent: number;
  phase: string;
  /** Pozostały czas w minutach, jeśli da się go oszacować. */
  etaMin?: number;
}

export class InstallError extends Error {
  constructor(public key: "space" | "install", msg?: string) { super(msg || key); }
}

/** Część 1: instalacja z nośnika, nad Agamą. */
export interface InstallBackend {
  languages(): Promise<Lang[]>;
  regions(): Promise<Region[]>;
  keyboards(): Promise<Keyboard[]>;
  disks(): Promise<Disk[]>;
  /** Zmienia język działającego instalatora i domyślne wartości kolejnych kroków. */
  setLanguage(locale: string): Promise<void>;
  /** Przełącza układ klawiatury działającego instalatora (pole „Sprawdź układ”). */
  setKeymap(keymap: string): Promise<void>;
  /** Sprawdza plan bez instalowania (np. czy starczy miejsca). */
  check(plan: InstallPlan): Promise<void>;
  install(plan: InstallPlan, onProgress: (p: Progress) => void): Promise<void>;
  reboot(): Promise<void>;
}

export interface Network { ssid: string; secure: boolean; strength: number }
export interface NetworkAdvanced { ip: "auto" | "manual"; dns: "auto" | "cloudflare" | "google"; proxy: "none" | "auto" }

export interface FirstBootInfo {
  fullName: string;
  /** Instalacja obok Windows (dodatkowe slajdy). */
  beside: boolean;
  /** Komputer ma już internet po kablu: krok Sieć jest pomijany. */
  wired: boolean;
  /** Nazwa wykrytej karty NVIDIA albo null. */
  nvidia: string | null;
  /** Lista z Shrimp Install, jeśli istnieje (maks. 5 pozycji pokazujemy). */
  windowsApps: WinApp[] | null;
}

export interface DriverChoice {
  /** Kodeki i sterowniki („Zainstaluj (Zalecane)”). */
  install: boolean;
  /** Tylko z kartą NVIDIA. */
  nvidia?: "nvidia" | "open";
}

export class WifiError extends Error {}
export class OfflineError extends Error {}

/** Część 2: pierwsza konfiguracja po restarcie, backend Rust (shrimp-setup). */
export interface FirstBootBackend {
  info(): Promise<FirstBootInfo>;
  networks(): Promise<Network[]>;
  connect(ssid: string, password?: string): Promise<void>;
  connectHidden(ssid: string, security: "none" | "wpa2" | "wpa3", password?: string): Promise<void>;
  setNetworkAdvanced(a: NetworkAdvanced): Promise<void>;
  setAppearance(scheme: "default" | "prefer-dark", accent: string | null): Promise<void>;
  setDrivers(c: DriverChoice): Promise<void>;
  installApps(ids: string[], onProgress: (p: Progress) => void): Promise<void>;
  /** Zapisuje, że konfiguracja się skończyła; wykonuje odłożone zmiany systemu (sterowniki) i restart, jeśli trzeba. */
  finish(): Promise<void>;
}

export interface Backends {
  /** "install": nośnik (kroki 1–9), "firstboot": po restarcie (kroki 10–15), "demo": wszystko na danych z makiety. */
  mode: "install" | "firstboot" | "demo";
  install: InstallBackend;
  firstboot: FirstBootBackend;
}
