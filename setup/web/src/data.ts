import catalog from "./windows-apps.json";
// Stałe treści Setup. Teksty dokładnie jak w makiecie (shrimp-handoff/mockups/setup.html).

export interface Lang { name: string; locale: string }
export interface Region { label: string; tz: string; tzLabel: string }
export interface Keyboard { name: string; keymap: string }

/** ~22 języki w kolejności z makiety, z identyfikatorem locale Agamy. */
export const LANGS: Lang[] = [
  ["Polski", "pl_PL"], ["English", "en_US"], ["Deutsch", "de_DE"], ["Español", "es_ES"], ["Français", "fr_FR"],
  ["Italiano", "it_IT"], ["Čeština", "cs_CZ"], ["Slovenčina", "sk_SK"], ["Українська", "uk_UA"], ["Nederlands", "nl_NL"],
  ["Português", "pt_PT"], ["Svenska", "sv_SE"], ["Norsk", "nb_NO"], ["Dansk", "da_DK"], ["Suomi", "fi_FI"],
  ["Magyar", "hu_HU"], ["Lietuvių", "lt_LT"], ["Română", "ro_RO"], ["Türkçe", "tr_TR"], ["Ελληνικά", "el_GR"],
  ["日本語", "ja_JP"], ["中文", "zh_CN"],
].map(([name, l]) => ({ name, locale: l + ".UTF-8" }));

/** Kraje (kraje z wieloma strefami rozbite na miasta), strefa, polska nazwa strefy. */
export const REGIONS: Region[] = ([
  ["Polska", "Europe/Warsaw", "Europa/Warszawa"], ["Niemcy", "Europe/Berlin", "Europa/Berlin"], ["Austria", "Europe/Vienna", "Europa/Wiedeń"],
  ["Belgia", "Europe/Brussels", "Europa/Bruksela"], ["Chorwacja", "Europe/Zagreb", "Europa/Zagrzeb"], ["Czechy", "Europe/Prague", "Europa/Praga"],
  ["Dania", "Europe/Copenhagen", "Europa/Kopenhaga"], ["Estonia", "Europe/Tallinn", "Europa/Tallinn"], ["Finlandia", "Europe/Helsinki", "Europa/Helsinki"],
  ["Francja", "Europe/Paris", "Europa/Paryż"], ["Grecja", "Europe/Athens", "Europa/Ateny"], ["Hiszpania", "Europe/Madrid", "Europa/Madryt"],
  ["Hiszpania · Wyspy Kanaryjskie", "Atlantic/Canary", "Atlantyk/Wyspy Kanaryjskie"], ["Holandia", "Europe/Amsterdam", "Europa/Amsterdam"],
  ["Irlandia", "Europe/Dublin", "Europa/Dublin"], ["Islandia", "Atlantic/Reykjavik", "Atlantyk/Reykjavík"], ["Litwa", "Europe/Vilnius", "Europa/Wilno"],
  ["Łotwa", "Europe/Riga", "Europa/Ryga"], ["Norwegia", "Europe/Oslo", "Europa/Oslo"], ["Portugalia", "Europe/Lisbon", "Europa/Lizbona"],
  ["Rumunia", "Europe/Bucharest", "Europa/Bukareszt"], ["Słowacja", "Europe/Bratislava", "Europa/Bratysława"], ["Szwajcaria", "Europe/Zurich", "Europa/Zurych"],
  ["Szwecja", "Europe/Stockholm", "Europa/Sztokholm"], ["Turcja", "Europe/Istanbul", "Europa/Stambuł"], ["Ukraina", "Europe/Kyiv", "Europa/Kijów"],
  ["Węgry", "Europe/Budapest", "Europa/Budapeszt"], ["Wielka Brytania", "Europe/London", "Europa/Londyn"], ["Włochy", "Europe/Rome", "Europa/Rzym"],
  ["Stany Zjednoczone · Nowy Jork", "America/New_York", "Ameryka/Nowy Jork"], ["Stany Zjednoczone · Chicago", "America/Chicago", "Ameryka/Chicago"],
  ["Stany Zjednoczone · Denver", "America/Denver", "Ameryka/Denver"], ["Stany Zjednoczone · Los Angeles", "America/Los_Angeles", "Ameryka/Los Angeles"],
  ["Kanada · Toronto", "America/Toronto", "Ameryka/Toronto"], ["Kanada · Vancouver", "America/Vancouver", "Ameryka/Vancouver"],
  ["Meksyk", "America/Mexico_City", "Ameryka/Meksyk"], ["Brazylia", "America/Sao_Paulo", "Ameryka/São Paulo"], ["Argentyna", "America/Argentina/Buenos_Aires", "Ameryka/Buenos Aires"],
  ["Zjednoczone Emiraty Arabskie", "Asia/Dubai", "Azja/Dubaj"], ["Izrael", "Asia/Jerusalem", "Azja/Jerozolima"], ["Indie", "Asia/Kolkata", "Azja/Kalkuta"],
  ["Tajlandia", "Asia/Bangkok", "Azja/Bangkok"], ["Chiny", "Asia/Shanghai", "Azja/Szanghaj"], ["Korea Południowa", "Asia/Seoul", "Azja/Seul"],
  ["Japonia", "Asia/Tokyo", "Azja/Tokio"], ["Australia · Sydney", "Australia/Sydney", "Australia/Sydney"], ["Australia · Perth", "Australia/Perth", "Australia/Perth"],
  ["Nowa Zelandia", "Pacific/Auckland", "Pacyfik/Auckland"], ["Republika Południowej Afryki", "Africa/Johannesburg", "Afryka/Johannesburg"], ["Egipt", "Africa/Cairo", "Afryka/Kair"],
] as const).map(([label, tz, tzLabel]) => ({ label, tz, tzLabel }));

/** Układy klawiatury; identyfikatory w formacie Agamy (xkb „układ(wariant)”). */
export const KEYBOARDS: Keyboard[] = [
  ["Polski (programisty)", "pl"], ["Polski (maszynistki)", "pl(qwertz)"], ["Angielski (USA)", "us"],
  ["Angielski (Wielka Brytania)", "gb"], ["Niemiecki", "de"], ["Francuski", "fr"], ["Hiszpański", "es"],
  ["Czeski", "cz"], ["Ukraiński", "ua"], ["Rosyjski", "ru"],
].map(([name, keymap]) => ({ name, keymap }));

/** Domyślny układ dla języka (pierwszy krok wpływa na kolejne). */
export const DEFAULT_KB: Record<string, string> = {
  pl_PL: "pl", en_US: "us", de_DE: "de", es_ES: "es", fr_FR: "fr", cs_CZ: "cz", uk_UA: "ua",
};
export const DEFAULT_TZ: Record<string, string> = {
  pl_PL: "Europe/Warsaw", de_DE: "Europe/Berlin", es_ES: "Europe/Madrid", fr_FR: "Europe/Paris", it_IT: "Europe/Rome",
  cs_CZ: "Europe/Prague", sk_SK: "Europe/Bratislava", uk_UA: "Europe/Kyiv", nl_NL: "Europe/Amsterdam", pt_PT: "Europe/Lisbon",
  sv_SE: "Europe/Stockholm", nb_NO: "Europe/Oslo", da_DK: "Europe/Copenhagen", fi_FI: "Europe/Helsinki", hu_HU: "Europe/Budapest",
  lt_LT: "Europe/Vilnius", ro_RO: "Europe/Bucharest", tr_TR: "Europe/Istanbul", el_GR: "Europe/Athens", ja_JP: "Asia/Tokyo",
  zh_CN: "Asia/Shanghai",
};

export const HELLO = ["Witaj", "Hello", "Hallo", "Bonjour", "Hola", "Ciao"];
export const ENCS = ["Wyłączone", "Włączone"];
export const HSEC = ["Brak", "WPA2", "WPA3"];
export const IPS = ["Automatyczny <em>(Zalecane)</em>", "Ręczny"];
export const DNSS = ["Automatyczny <em>(Zalecane)</em>", "Cloudflare", "Google"];
export const PROXY = ["Brak", "Automatyczny"];
export const THEMES = ["Jasny", "Ciemny"];
export const DRV = ["Zainstaluj <em>(Zalecane)</em>", "Zrobię to później"];
export const NV = ["Sterownik NVIDIA <em>(Zalecane)</em>", "Sterownik otwarty"];

/** Kolory dodatkowe GNOME: nazwa, wartość `accent-color`, kolor. */
export const ACCENTS: [string, string, string][] = [
  ["Niebieski", "blue", "#3584e4"], ["Morski", "teal", "#2190a4"], ["Zielony", "green", "#3a944a"],
  ["Żółty", "yellow", "#c88800"], ["Pomarańczowy", "orange", "#ed5b00"], ["Czerwony", "red", "#e62d42"],
  ["Różowy", "pink", "#d56199"], ["Fioletowy", "purple", "#9141ac"], ["Szary", "slate", "#6f8396"],
];

export const PLACES = [
  { n: "Obok Windows <em>(Zalecane)</em>", d: "" },
  { n: "Zamiast Windows", d: "Windows zostanie usunięty. Zachowane pliki przeniesiemy do nowego systemu." },
];

/** Minimum dla Shrimp i zapas ponad zajęte miejsce Windows (GB). */
export const SHRIMP_MIN_GB = 40;
export const WINDOWS_SPARE_GB = 20;

export interface App { id: string; name: string; what: string }
export const USES = ["Praca i nauka", "Gry", "Twórczość", "Programowanie", "Multimedia"];
/** Kategorie → aplikacje z Flathub (specs/setup.md › Programy). */
export const APPS: App[][] = [
  [{ id: "org.libreoffice.LibreOffice", name: "LibreOffice", what: "Dokumenty i arkusze" }, { id: "org.mozilla.Thunderbird", name: "Thunderbird", what: "Poczta" }],
  [{ id: "com.valvesoftware.Steam", name: "Steam", what: "Gry" }, { id: "com.heroicgameslauncher.hgl", name: "Heroic", what: "Gry z Epic i GOG" }],
  [{ id: "org.kde.krita", name: "Krita", what: "Rysowanie" }, { id: "org.kde.kdenlive", name: "Kdenlive", what: "Montaż wideo" }, { id: "org.gimp.GIMP", name: "GIMP", what: "Grafika" }],
  [{ id: "com.visualstudio.code", name: "Visual Studio Code", what: "Edytor kodu" }, { id: "org.gnome.Builder", name: "GNOME Builder", what: "Środowisko pracy" }],
  [{ id: "org.videolan.VLC", name: "VLC", what: "Filmy i muzyka" }, { id: "com.spotify.Client", name: "Spotify", what: "Muzyka" }],
];

/** Program z Windows (lista zapisana przez Shrimp Install) i jego odpowiednik. */
export interface WinApp { windows: string; name: string; id: string }

/**
 * Katalog programów Windows (windows-apps.json): cała logika dopasowania jest w danych.
 * `re` sprawdza nazwę z listy programów Windows (DisplayName, np. „Microsoft 365 Apps for business - pl-pl”),
 * `store` nazwę pakietu Microsoft Store. Kolejność wpisów = kolejność podpowiedzi. Wpis bez `linux` czeka na odpowiednik.
 */
export interface CatalogApp {
  windows: string; re: RegExp; store?: RegExp;
  linux: { name: string; id: string } | null;
  /** Odpowiednik jest już w systemie, nie instalujemy go. */
  base?: boolean;
  /** driver, builtin, unneeded: nic do zaproponowania, bo system robi to sam. */
  skip?: "driver" | "builtin" | "unneeded";
}
interface CatalogJson { apps: { windows: string; re: string; store?: string; linux: { name: string; id: string } | null; base?: boolean; skip?: CatalogApp["skip"] }[] }

export const WIN_CATALOG: CatalogApp[] = (catalog as CatalogJson).apps.map((a) => ({
  ...a, re: new RegExp(a.re, "i"), store: a.store ? new RegExp(a.store, "i") : undefined,
}));

/** Układ klawiatury Windows (KLID) → układ xkb. Poza tą listą liczy się język układu (4 ostatnie cyfry). */
export const KLID_XKB: Record<string, string> = {
  "00000415": "pl", "00010415": "pl(qwertz)", "00000409": "us", "00020409": "us", "00000809": "gb",
  "00000407": "de", "0000040c": "fr", "0000040a": "es", "00000c0a": "es", "00000405": "cz",
  "00000422": "ua", "00020422": "ua", "00000419": "ru",
};
export const LANGID_XKB: Record<string, string> = {
  "0415": "pl", "0409": "us", "0809": "gb", "0407": "de", "040c": "fr", "040a": "es", "0c0a": "es", "0405": "cz", "0422": "ua", "0419": "ru",
};
/** Stare nazwy stref, które Windows (ICU) może jeszcze zwracać. */
export const TZ_ALIAS: Record<string, string> = { "Europe/Kiev": "Europe/Kyiv", "Asia/Calcutta": "Asia/Kolkata", "America/Buenos_Aires": "America/Argentina/Buenos_Aires" };

export type ErrKey = "pass" | "dpass" | "space" | "install" | "wifi" | "net";
export const ERR: Record<ErrKey, { t: string; d: string; p: string; s: string }> = {
  dpass: { t: "Hasła dysku się różnią", d: "Wpisz to samo hasło w obu polach. Bez niego nie uruchomisz komputera, więc zapisz je w bezpiecznym miejscu.", p: "Spróbuj ponownie", s: "" },
  pass: { t: "Hasła się różnią", d: "Wpisz to samo hasło w obu polach i spróbuj ponownie.", p: "Spróbuj ponownie", s: "" },
  space: { t: "Za mało miejsca", d: "Na dysku nie ma wystarczająco miejsca dla Shrimp. Zmniejsz rozmiar Windows lub wybierz inny dysk.", p: "Zmień rozmiar", s: "Wróć" },
  install: { t: "Instalacja nie powiodła się", d: "Coś poszło nie tak. Twoje pliki są bezpieczne. Możesz spróbować ponownie.", p: "Spróbuj ponownie", s: "Zakończ" },
  wifi: { t: "Nie udało się połączyć", d: "Sprawdź hasło sieci i spróbuj ponownie.", p: "Spróbuj ponownie", s: "Pomiń" },
  net: { t: "Brak połączenia z internetem", d: "Nie udało się pobrać programów. Sprawdź połączenie i spróbuj ponownie.", p: "Spróbuj ponownie", s: "Pomiń" },
};

export function slides(beside: boolean) {
  const a: { t: string; d: string }[] = [];
  a.push({ t: "Shrimp to Linux", d: "Linux to darmowy system tworzony przez ludzi z całego świata. Działa na nim większość serwerów i telefonów z Androidem." });
  if (beside) a.push({ t: "Windows obok", d: "Przy każdym uruchomieniu wybierzesz Shrimp lub Windows." });
  a.push({ t: "Programy", d: "Pliki .exe z Windows tu nie działają. Programy instalujesz z Shrimp Apps, a dla większości znanych aplikacji znajdziesz tam odpowiednik." });
  a.push({ t: "Hasło przy zmianach", d: "Przy instalowaniu programów lub zmianie ważnych ustawień system poprosi o Twoje hasło. To normalne i chroni komputer." });
  a.push({ t: "Twoje pliki", d: "Dokumenty, zdjęcia i pobrane pliki są w aplikacji Pliki, w folderze domowym." + (beside ? " Tam też znajdziesz dysk z Windows." : "") });
  a.push({ t: "Panko", d: "Coś przestało działać po zmianie? W Panko wrócisz do stanu sprzed niej." });
  a.push({ t: "Cocktail", d: "Aktualizacje, sterowniki i kodeki w jednym miejscu. Aktualizacje instalują się przy ponownym uruchomieniu." });
  a.push({ t: "Szybkie wyszukiwanie", d: "Naciśnij klawisz Super, czyli klawisz z logo Windows, aby znaleźć programy, pliki i ustawienia." });
  a.push({ t: "Pomoc", d: "Odpowiedzi na pytania znajdziesz na stronach pomocy Shrimp, w dokumentacji GNOME i openSUSE oraz na forach społeczności." });
  return a;
}
