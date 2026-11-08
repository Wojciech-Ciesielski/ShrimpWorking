#!/bin/bash
# Buduje Panko i instaluje go do DESTDIR (pakiet, obraz KIWI albo test).
#   apps/panko/install.sh DESTDIR
# Wymaga: cargo, pakiety deweloperskie gtk4 (4.14+) i libadwaita-1 (1.5+).
# PANKO_PREBUILT=1: program zbudowany wcześniej (np. w chroot Leap, jak tools/build-setup.sh).
set -euo pipefail
D=${1:?użycie: install.sh DESTDIR}
HERE=$(cd "$(dirname "$0")" && pwd)

if [ -z "${PANKO_PREBUILT:-}" ]; then
  (cd "$HERE" && cargo build --release --locked)
fi
install -Dm755 "$HERE/target/release/panko" "$D/usr/bin/panko"
install -Dm644 "$HERE/data/org.shrimp.Panko.desktop" "$D/usr/share/applications/org.shrimp.Panko.desktop"
install -Dm644 "$HERE/data/org.shrimp.Panko.policy" "$D/usr/share/polkit-1/actions/org.shrimp.Panko.policy"
install -Dm644 "$HERE/data/panko-cleanup.service" "$D/usr/lib/systemd/system/panko-cleanup.service"
install -Dm644 "$HERE/data/panko-cleanup.timer" "$D/usr/lib/systemd/system/panko-cleanup.timer"
# W obrazie: systemctl enable panko-cleanup.timer (np. w kiwi/config.sh). Bez pliku
# /etc/panko/panko.conf (ustawienie wyłączone) usługa nic nie robi.
echo "Panko zainstalowany w $D"
