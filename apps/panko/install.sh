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
echo "Panko zainstalowany w $D"
