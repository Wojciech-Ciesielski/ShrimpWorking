// Umowa między interfejsem Shrimp Install a programem (host w C, src/shrimp/ w forku Rufusa).
// Rozmiary w bajtach, czasy w sekundach.

export type FolderKey = "documents" | "pictures" | "desktop" | "music" | "videos" | "downloads";

export interface Device {
  /** Numer dysku w Rufusie (DriveIndex). */
  id: number;
  /** Np. „SanDisk Ultra (E:)”. */
  name: string;
  /** Rodzaj nośnika: usb, sd lub disk (nazwa w interfejsie: klucz kind.<rodzaj>). */
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

/** Dysk z Windows (partycja systemowa, zwykle C:), z PowerShella: Get-Partition, Get-PartitionSupportedSize, Get-Disk. */
export interface WinDisk {
  /** false: Windows nie podał rozmiarów (wtedy tylko „Zamiast Windows”). */
  ok: boolean;
  letter: string;
  /** Rozmiar partycji. */
  size: number;
  /** Najmniejszy rozmiar, do jakiego Windows ją zmniejszy. */
  min: number;
  /** Cały dysk. */
  disk: number;
  /** Największy nieprzydzielony obszar na dysku. */
  free: number;
}

export interface Info {
  /** Dysk z Windows zaszyfrowany BitLockerem. */
  bitlocker: boolean;
  /** Rozmiar obrazu Shrimp (z manifestu albo szacunek). */
  shrimpSize: number;
  /** Minimalny rozmiar nośnika. */
  minSize: number;
  folders: Folder[];
  /** Dysk z Windows, gdy program już go sprawdził (inaczej przychodzi zdarzeniem, onDisk). */
  disk?: WinDisk;
  /** Adres strony pomocy z manifestu wydania (https://…); bez niego działa wpis z boxes/help-links/help.json. */
  helpUrl?: string;
}

/** 1 pobieranie, 2 zapis nośnika, 3 kopia plików, 4 miejsce dla Shrimp na dysku z Windows (tylko „Obok Windows”). */
export type Phase = 1 | 2 | 3 | 4;

export interface Progress {
  phase: Phase;
  done: number;
  total: number;
  /** Bajty na sekundę, 0 gdy jeszcze nie wiadomo. */
  speed: number;
  /** Krok w fazie: verify (suma obrazu pobranego wcześniej), prepare (analiza i formatowanie),
   *  backup (kopia zawartości nośnika). Brak: główna praca fazy. */
  step?: "verify" | "prepare" | "backup";
}

export type FailKind = "offline" | "verify" | "write" | "copy" | "space" | "device" | "busy" | "question" | "shrink" | "other";
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
  /** Prawdziwy rozmiar obrazu, gdy program przeczyta manifest (wcześniej Info.shrimpSize to szacunek). */
  image?(size: number): void;
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
  /** Rozmiary dysku z Windows (sprawdzanie trwa do kilkudziesięciu sekund). */
  onDisk(cb: (d: WinDisk) => void): void;
  /** Ile bajtów wolnego miejsca zrobić dla Shrimp na dysku z Windows (faza 4); 0: „Zamiast Windows”. Przed start. */
  setSpace(bytes: number): Promise<void>;
  /** Ponawia samą fazę 4 po błędzie (nośnik jest gotowy); wynik przez zdarzenia z start. */
  retryShrink(): void;
  /** Alt+F4 albo zamknięcie z paska zadań w trakcie przygotowania. */
  onCloseRequest(cb: () => void): void;
  pick(kind: "folder" | "file"): Promise<Picked[]>;
  start(plan: Plan, ev: RunEvents): void;
  cancel(): Promise<void>;
  /** Ustawia jednorazowy start z nośnika i uruchamia ponownie. Rzuca błąd z opisem. */
  reboot(): Promise<void>;
  /** Otwiera stronę (https://…) w przeglądarce użytkownika; host odrzuca inne adresy. */
  openUrl(url: string): void;
  later(): void;
  minimize(): void;
  close(): void;
  drag(): void;
}
