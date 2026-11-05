# ShrimpWorking
Pracujemy nad distro

## ISO (Shrimp Beta, live)

- Opis obrazu KIWI: `kiwi/` (`config.kiwi`, `config.sh`, nakładka plików `kiwi/root/`).
- Budowa: workflow **Build ISO** w GitHub Actions (artefakt `shrimp-live-iso`) albo lokalnie `sudo tools/build-iso.sh 16.1` (Docker/Podman).
- Użytkownik live: `shrimp`, hasło `shrimp` (logowanie automatyczne).
- Grafiki Plymouth/GRUB są renderowane z makiety `boot.html`: `node tools/render-boot-assets.js <shrimp-handoff> <out>`.

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

`standardize/shrimp-app-style` ustawia globalne nadpisania Flatpaka, żeby aplikacje GTK3, Qt i Electron wyglądały i zachowywały się jak GTK4/libadwaita: motyw adw-gtk3 (jasny/ciemny według trybu użytkownika), styl Adwaita dla Qt, okna plików i ustawienia przez portal, Wayland dla Electron. Toolkitu aplikacji nie da się podmienić, więc pasek tytułu Electron zostaje własny. Uruchamia się samo po każdej instalacji aplikacji (`shrimp-app-style.path`) i przy zmianie trybu (`shrimp-app-style-user.service`).
