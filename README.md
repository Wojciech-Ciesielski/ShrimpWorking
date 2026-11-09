# ShrimpWorking
Pracujemy nad distro

Zasada: w repo nie ma zrzutów ekranu ani zapisanych wyników testów, a CI niczego do niego nie commituje (wyjątek: dane weryfikacji Web Apps). Dzienniki testów są tylko artefaktami przebiegów w GitHub Actions (14 dni). Pilnuje tego workflow **Bez zrzutów** (`tools/bez-zrzutow.sh`, można uruchomić lokalnie przed pushem).

## ISO (Shrimp Beta, live)

- Opis obrazu KIWI: `kiwi/` (`config.kiwi`, `config.sh`, nakładka plików `kiwi/root/`).
- Budowa: workflow **Build ISO** w GitHub Actions (artefakt `shrimp-live-iso`) albo lokalnie `sudo tools/build-iso.sh 16.1` (Docker/Podman).
- Użytkownik live: `shrimp`, hasło `shrimp` (logowanie automatyczne).
- Shrimp Setup jest częścią obrazu: `tools/build-setup.sh` buduje okno w chroocie Leap (te same biblioteki co ISO) i instaluje Setup (`setup/install.sh --live`) do kopii opisu KIWI w `out/desc`; Agama 24 serwuje interfejs na `127.0.0.1:80`, a okno startuje z autostartu sesji live.
- Menu systemowe: logo Shrimp z lewej strony górnego paska (własne rozszerzenie `shrimp-menu@shrimp` w `kiwi/root/usr/share/gnome-shell/extensions/`): O tym komputerze, Ustawienia, Oprogramowanie (Shrimp Apps), Aktualizacje (Cocktail; do czasu jego dodania strona Zainstalowane w Shrimp Apps), Przywracanie systemu (Panko), narzędzia systemowe, Uśpij, Uruchom ponownie, Wyłącz, Zablokuj, Wyloguj. Pozycje programów, których nie ma w obrazie, są ukryte. Teksty: tłumaczenia GNOME (gnome-shell, nazwy programów), a czego GNOME nie ma, to `lang/` w formacie `i18n/` (wszystkie języki GNOME). Szybkie ustawienia (prawy róg) mają dźwięk (PipeWire), Bluetooth, tryb zasilania i baterię w procentach. Bez menu „Programy”: aplikacje są w siatce w doku.
- Grafiki Plymouth/GRUB są renderowane z makiety `boot.html`: `node tools/render-boot-assets.js <shrimp-handoff> <out>`.

## Linu(x)

Standard Shrimp ponad zwykłego Linuksa (pełna nazwa i hasło tylko na stronie projektu). Użytkownik nie widzi nazwy w systemie: nie ma jej w `os-release`, `issue` ani `motd`. Na nośniku live jest w `kiwi/root/usr/share/shrimp/linux/` (uruchamia je `kiwi/config.sh`):

- **Oficjalny sterownik NVIDIA** (`build/20-nvidia.sh`): otwarte moduły podpisane przez SUSE (Turing i nowsze, działają z Secure Boot) + biblioteki z repozytorium NVIDIA, które zostaje w systemie. Starsze karty zostają przy nouveau: decyduje `/usr/libexec/shrimp-gpu-gate` (awaryjnie parametr jądra `shrimp.nouveau=1`).
- **Kodeki przez PipeWire** (`config.kiwi` + `build/10-codecs.sh`): PipeWire jako jedyny serwer dźwięku, GStreamer z wtyczką PipeWire i kodekami z Leap, H.264 przez openh264 od Cisco. Bez Packmana.
- **Wygląd libadwaita dla Qt i Electron** (`build/30-app-style.sh` → `standardize/shrimp-app-style`, patrz niżej).

Brak pakietu lub repozytorium nie przerywa budowy, tylko daje linię `WARNING: Linu(x): …` w logu (`tools/build-iso.sh` ją wypisuje).

## Setup (instalator i pierwsza konfiguracja)

Jeden interfejs z makiety `setup.html`, w dwóch częściach:

- **Instalacja** (kroki 1–9, nośnik): `shrimp-setup --install` otwiera na pełnym ekranie interfejs serwowany przez `agama-web-server --web-ui-dir /usr/share/shrimp-setup/ui` i rozmawia z HTTP API Agamy (Leap 16.1, API v2). Produkt Agamy: `setup/system/agama/shrimp.yaml` (tryb niezmienny, jeden wolumin Btrfs).
- **Pierwsza konfiguracja** (kroki 10–15, po restarcie): `post-install.sh` włącza jednorazowe logowanie automatyczne, a `shrimp-setup --first-boot` uruchamia lokalny serwer w Rust (sieć przez NetworkManager, wygląd przez GSettings, programy z Flathub). Kodeki i sterownik NVIDIA instaluje na końcu `shrimp-setup-apply` (pkexec → transactional-update, jedna migawka). Pakiety: `setup/system/share/drivers.conf`.
- **Pliki z Windows** (Shrimp Install) (`shrimp-install/`, program dla Windows): nośnik ma `shrimp-transfer/shrimp.json` i pliki użytkownika. `shrimp-setup --install` podaje stronie podpowiedzi (`window.SHRIMP_TRANSFER`: imię, język, strefa, klawiatura, BitLocker, rozmiar plików), a `post-install.sh` wywołuje `shrimp-setup --restore`: foldery Windows trafiają do folderów nowego konta w jego języku (Dokumenty, Obrazy…), pliki > 4 GB są sklejane, wpis UEFI „Shrimp Install” jest usuwany. Krok Programy dobiera odpowiedniki po wzorcach nazw (`WIN_MATCH` w `setup/web/src/data.ts`).

Katalogi: `setup/web` (TypeScript, Vite), `setup/shell` (Rust, GTK4 + WebKitGTK 6), `setup/system` (Agama, polkit, autostart, skrypty).
Podgląd w przeglądarce na danych z makiety: `cd setup/web && npm ci && npm run dev` (`?step=4&sub=1`, `?err=space`, `?fail=install`, `?bitlocker=1`).
Budowa i instalacja do katalogu (pakiet/KIWI): `setup/install.sh DESTDIR [--live]`.

## Shrimp Install (Windows)

Fork Rufusa 4.16: pobiera Shrimp, zapisuje nośnik, kopiuje pliki i listę programów, uruchamia komputer z nośnika. Opis, protokół i schemat `shrimp.json`: `shrimp-install/README.md`. Budowa `.exe`: workflow **Shrimp Install** (artefakt `shrimp-install`).

## Jeden wygląd aplikacji

`standardize/shrimp-app-style` ustawia globalne nadpisania Flatpaka, żeby aplikacje GTK3, Qt i Electron wyglądały i zachowywały się jak GTK4/libadwaita: motyw adw-gtk3 (jasny/ciemny według trybu użytkownika), styl Adwaita i pasek tytułu Adwaita dla Qt (`QT_WAYLAND_DECORATION=adwaita`), okna plików i ustawienia przez portal, Wayland dla Electron. Toolkitu aplikacji nie da się podmienić, więc pasek tytułu Electron zostaje własny. Uruchamia się samo po każdej instalacji aplikacji (`shrimp-app-style.path`) i przy zmianie trybu (`shrimp-app-style-user.service`).

## Shrimp Apps

Sklep z aplikacjami z Flathub (GTK4 + libadwaita + Rust, libflatpak): `apps/shrimp-apps/`. Odkrywaj, kategorie, wyszukiwanie, strona aplikacji, instalacja, aktualizacja i usuwanie. Co działa i czego brakuje: `apps/shrimp-apps/README.md`. Workflow **Shrimp Apps** testuje go na lokalnym repozytorium i na prawdziwym Flathub.

## Cocktail (aktualizacje i pakiety)

`apps/cocktail`: GTK4 + libadwaita w Rust, nakładka na zyppera i `transactional-update` (Aktualizacje, Urządzenia, Pakiety, Historia). Zmiany w systemie przez pkexec (`cocktail-helper`, `cocktail-query`, polkit `org.shrimp.cocktail.*`). Opis, budowa, testy i lista braków: `apps/cocktail/README.md`. Workflow **Cocktail**.

## Aplikacje GNOME (GTK4 + libadwaita, Rust)

- **Panko** (`apps/panko`): cofanie zmian w systemie – migawki, porównanie z obecnym stanem, przywracanie plików i systemu, ustawienia migawek. Podgląd bez systemu: `cd apps/panko && cargo run -- --demo`. Stan i braki: `apps/panko/README.md`. Jeszcze nie ma go na ISO.
