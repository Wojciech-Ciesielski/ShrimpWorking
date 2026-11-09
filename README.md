# ShrimpWorking
Pracujemy nad distro

## Struktura: boxy i kontenery

Cały kod leży w boxach (`boxes/<id>/` z plikiem `box.toml`: identyfikator, zależności, pakiety, budowa), a kontenery (`containers/`) mówią, które boxy tworzą produkt: `iso-live` (nośnik), `desktop` (pulpit), `shrimp-install` (Windows), `site` (strona). Opis i zasady: [`boxes/README.md`](boxes/README.md). Sprawdzenie: `cd boxes/shrimp-box && cargo run -- check` (workflow **Boxy**).

Wyniki testów z CI (zrzuty ekranu, dzienniki QEMU, inwentarze) nie trafiają do gałęzi z kodem. Workflowy zapisują je przez `tools/ci-wyniki.sh` na osobnej gałęzi `wyniki-testow`, w katalogach `<gałąź>/<rodzaj>/` (np. `main/iso/`). Każdy przebieg zastępuje poprzedni wynik, a gałąź można usunąć w dowolnej chwili.

Zasada: żaden PR nie dodaje zrzutów ekranu ani `test-results/`. Pilnuje tego workflow **Bez zrzutów** (`tools/bez-zrzutow.sh`, można uruchomić lokalnie przed pushem).

## ISO (Shrimp Beta, live)

- Opis obrazu KIWI składa `shrimp-box image iso-live` z boxów kontenera `iso-live`: szablon `boxes/image-base/config.kiwi` + pakiety boxów, `config.sh` z fragmentów `boxes/*/configure.sh`, nakładka z `boxes/*/root/`.
- Budowa: workflow **Build ISO** w GitHub Actions (artefakt `shrimp-live-iso`) albo lokalnie `sudo tools/build-iso.sh 16.1` (Docker/Podman).
- Użytkownik live: `shrimp`, hasło `shrimp` (logowanie automatyczne).
- Shrimp Setup jest częścią obrazu (box `setup` z argumentem `--live`): shrimp-box buduje okno w chroocie Leap (te same biblioteki co ISO) i instaluje Setup (`boxes/setup/install.sh --live`) do opisu KIWI w `out/desc`; Agama 24 serwuje interfejs na `127.0.0.1:80`, a okno startuje z autostartu sesji live.
- Menu systemowe: logo Shrimp z lewej strony górnego paska (box `shrimp-menu`, rozszerzenie `shrimp-menu@shrimp`): O tym komputerze, Ustawienia, Oprogramowanie (Shrimp Apps), Aktualizacje (Cocktail; do czasu jego dodania strona Zainstalowane w Shrimp Apps), Przywracanie systemu (Panko), narzędzia systemowe, Uśpij, Uruchom ponownie, Wyłącz, Zablokuj, Wyloguj. Pozycje programów, których nie ma w obrazie, są ukryte. Teksty: tłumaczenia GNOME (gnome-shell, nazwy programów), a czego GNOME nie ma, to `lang/` w formacie `boxes/i18n-core` (wszystkie języki GNOME). Szybkie ustawienia (prawy róg) mają dźwięk (PipeWire), Bluetooth, tryb zasilania i baterię w procentach. Bez menu „Programy”: aplikacje są w siatce w doku.
- Grafiki Plymouth/GRUB są renderowane z makiety `boot.html`: `node boxes/plymouth-theme/tools/render-boot-assets.js <shrimp-handoff> <out>`.

## Linu(x)

Standard Shrimp ponad zwykłego Linuksa (pełna nazwa i hasło tylko na stronie projektu). Użytkownik nie widzi nazwy w systemie: nie ma jej w `os-release`, `issue` ani `motd`. Box `linu-x` (`boxes/linu-x/root/usr/share/shrimp/linux/`, uruchamia je `boxes/linu-x/configure.sh`):

- **Oficjalny sterownik NVIDIA** (`build/20-nvidia.sh`): otwarte moduły podpisane przez SUSE (Turing i nowsze, działają z Secure Boot) + biblioteki z repozytorium NVIDIA, które zostaje w systemie. Starsze karty zostają przy nouveau: decyduje `/usr/libexec/shrimp-gpu-gate` (awaryjnie parametr jądra `shrimp.nouveau=1`).
- **Kodeki przez PipeWire** (pakiety boxa `linu-x` + `build/10-codecs.sh`): PipeWire jako jedyny serwer dźwięku, GStreamer z wtyczką PipeWire i kodekami z Leap, H.264 przez openh264 od Cisco. Bez Packmana.
- **Wygląd libadwaita dla Qt i Electron** (`build/30-app-style.sh` → box `app-style`, patrz niżej).

Brak pakietu lub repozytorium nie przerywa budowy, tylko daje linię `WARNING: Linu(x): …` w logu (`tools/build-iso.sh` ją wypisuje).

## Setup (instalator i pierwsza konfiguracja)

Jeden interfejs z makiety `setup.html`, w dwóch częściach:

- **Instalacja** (kroki 1–9, nośnik): `shrimp-setup --install` otwiera na pełnym ekranie interfejs serwowany przez `agama-web-server --web-ui-dir /usr/share/shrimp-setup/ui` i rozmawia z HTTP API Agamy (Leap 16.1, API v2). Produkt Agamy: `boxes/setup/system/agama/shrimp.yaml` (tryb niezmienny, jeden wolumin Btrfs).
- **Pierwsza konfiguracja** (kroki 10–15, po restarcie): `post-install.sh` włącza jednorazowe logowanie automatyczne, a `shrimp-setup --first-boot` uruchamia lokalny serwer w Rust (sieć przez NetworkManager, wygląd przez GSettings, programy z Flathub). Kodeki i sterownik NVIDIA instaluje na końcu `shrimp-setup-apply` (pkexec → transactional-update, jedna migawka). Pakiety: `boxes/setup/system/share/drivers.conf`.
- **Pliki z Windows** (Shrimp Install) (`boxes/shrimp-install/`, program dla Windows): nośnik ma `shrimp-transfer/shrimp.json` i pliki użytkownika. `shrimp-setup --install` podaje stronie podpowiedzi (`window.SHRIMP_TRANSFER`: imię, język, strefa, klawiatura, BitLocker, rozmiar plików), a `post-install.sh` wywołuje `shrimp-setup --restore`: foldery Windows trafiają do folderów nowego konta w jego języku (Dokumenty, Obrazy…), pliki > 4 GB są sklejane, wpis UEFI „Shrimp Install” jest usuwany. Krok Programy dobiera odpowiedniki po wzorcach nazw (`WIN_MATCH` w `boxes/setup/web/src/data.ts`).

Katalogi boxa `setup`: `web` (TypeScript, Vite), `shell` (Rust, GTK4 + WebKitGTK 6), `system` (Agama, polkit, autostart, skrypty), `i18n` (teksty).
Podgląd w przeglądarce na danych z makiety: `cd boxes/setup/web && npm ci && npm run dev` (`?step=4&sub=1`, `?err=space`, `?fail=install`, `?bitlocker=1`).
Budowa i instalacja do katalogu (pakiet/KIWI): `boxes/setup/install.sh DESTDIR [--live]`.

## Shrimp Install (Windows)

Fork Rufusa 4.16: pobiera Shrimp, zapisuje nośnik, kopiuje pliki i listę programów, uruchamia komputer z nośnika. Opis i protokół: `boxes/shrimp-install/README.md`, schemat `shrimp.json`: `boxes/install-schema`. Budowa `.exe`: workflow **Shrimp Install** (artefakt `shrimp-install`).

## Jeden wygląd aplikacji

`boxes/app-style/shrimp-app-style` ustawia globalne nadpisania Flatpaka, żeby aplikacje GTK3, Qt i Electron wyglądały i zachowywały się jak GTK4/libadwaita: motyw adw-gtk3 (jasny/ciemny według trybu użytkownika), styl Adwaita i pasek tytułu Adwaita dla Qt (`QT_WAYLAND_DECORATION=adwaita`), okna plików i ustawienia przez portal, Wayland dla Electron. Toolkitu aplikacji nie da się podmienić, więc pasek tytułu Electron zostaje własny. Uruchamia się samo po każdej instalacji aplikacji (`shrimp-app-style.path`) i przy zmianie trybu (`shrimp-app-style-user.service`).

## Shrimp Apps

Sklep z aplikacjami z Flathub (GTK4 + libadwaita + Rust, libflatpak): `boxes/shrimp-apps/`. Odkrywaj, kategorie, wyszukiwanie, strona aplikacji, instalacja, aktualizacja i usuwanie. Co działa i czego brakuje: `boxes/shrimp-apps/README.md`. Workflow **Shrimp Apps** testuje go na lokalnym repozytorium i na prawdziwym Flathub, zrzuty na gałęzi `wyniki-testow` (`<gałąź>/shrimp-apps/`).

## Cocktail (aktualizacje i pakiety)

`boxes/cocktail`: GTK4 + libadwaita w Rust, nakładka na zyppera i `transactional-update` (Aktualizacje, Urządzenia, Pakiety, Historia). Zmiany w systemie przez pkexec (`cocktail-helper`, `cocktail-query`, polkit `org.shrimp.cocktail.*`). Opis, budowa, testy i lista braków: `boxes/cocktail/README.md`. Workflow **Cocktail** (artefakt `cocktail-screens`).

## Aplikacje GNOME (GTK4 + libadwaita, Rust)

- **Panko** (`boxes/panko`): cofanie zmian w systemie – migawki, porównanie z obecnym stanem, przywracanie plików i systemu, ustawienia migawek. Podgląd bez systemu: `cd boxes/panko && cargo run -- --demo`. Stan i braki: `boxes/panko/README.md`.
