# ShrimpWorking
Pracujemy nad distro

## ISO (Shrimp Beta, live)

- Opis obrazu KIWI: `kiwi/` (`config.kiwi`, `config.sh`, nakładka plików `kiwi/root/`).
- Budowa: workflow **Build ISO** w GitHub Actions (artefakt `shrimp-live-iso`) albo lokalnie `sudo tools/build-iso.sh 16.1` (Docker/Podman).
- Użytkownik live: `shrimp`, hasło `shrimp` (logowanie automatyczne).
- Grafiki Plymouth/GRUB są renderowane z makiety `boot.html`: `node tools/render-boot-assets.js <shrimp-handoff> <out>`.
