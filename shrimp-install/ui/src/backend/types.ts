// Umowa między interfejsem Shrimp Install a programem (host w C, src/shrimp/ w forku Rufusa).
// Rozmiary w bajtach, czasy w sekundach.

export type FolderKey = "documents" | "pictures" | "desktop" | "music" | "videos" | "downloads";

export interface Device {
  /** Numer dysku w Rufusie (DriveIndex). */
  id: number;
  /** Np. „SanDisk Ultra (E:)”. */
  name: string;
  /** Pendrive, Karta SD, Dysk zewnętrzny. */
  kind: string;
  size: number;
}

export interface Folder {
  key: FolderKey;
  path: string;
  /** null, dopóki program liczy rozmiar. */
  size: number | null;
}

export interface Picked {
  path: string;
  name: string;
  kind: "folder" | "file";
  size: number;
}

export interface Info {
  /** Dysk z Windows zaszyfrowany BitLockerem. */
  bitlocker: boolean;
  /** Rozmiar obrazu Shrimp (z manifestu albo szacunek). */
  shrimpSize: number;
  /** Minimalny rozmiar nośnika. */
  minSize: number;
  folders: Folder[];
}

export type Phase = 1 | 2 | 3;

export interface Progress {
  phase: Phase;
  done: number;
  total: number;
  /** Bajty na sekundę, 0 gdy jeszcze nie wiadomo. */
  speed: number;
}

export type FailKind = "offline" | "verify" | "write" | "copy" | "space" | "device" | "other";
export interface Failure { phase: Phase; kind: FailKind; message?: string }

export interface Plan {
  device: number;
  /** Tryb „Moje foldery”: klucze folderów. */
  folders: FolderKey[];
  /** Tryb „Wybiorę sam”: ścieżki. */
  paths: string[];
}

export interface RunEvents {
  progress(p: Progress): void;
  fail(f: Failure): void;
  done(): void;
}

export interface Backend {
  info(): Promise<Info>;
  /** Wywołuje cb od razu z bieżącą listą i przy każdej zmianie (podłączenie, odłączenie). */
  onDevices(cb: (d: Device[]) => void): void;
  /** Rozmiary folderów liczą się w tle; cb dostaje każdą aktualizację. */
  onFolders(cb: (f: Folder[]) => void): void;
  /** Wynik sprawdzenia BitLockera przychodzi chwilę po starcie. */
  onBitLocker(cb: (on: boolean) => void): void;
  /** Alt+F4 albo zamknięcie z paska zadań w trakcie przygotowania. */
  onCloseRequest(cb: () => void): void;
  pick(kind: "folder" | "file"): Promise<Picked[]>;
  start(plan: Plan, ev: RunEvents): void;
  cancel(): Promise<void>;
  /** Ustawia jednorazowy start z nośnika i uruchamia ponownie. Rzuca błąd z opisem. */
  reboot(): Promise<void>;
  later(): void;
  minimize(): void;
  close(): void;
  drag(): void;
}
