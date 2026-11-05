#!/bin/bash
# Buduje Setup Shrimp i instaluje go do DESTDIR (pakiet, obraz KIWI albo test).
#   setup/install.sh DESTDIR [--live]
# --live dodaje części tylko dla nośnika: autostart instalatora, interfejs w Agamie, token.
# Wymaga: node 22+, cargo, pakiety deweloperskie gtk4 i webkitgtk-6.0.
set -euo pipefail
D=${1:?użycie: install.sh DESTDIR [--live]}
LIVE=${2:-}
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/.." && pwd)

(cd "$HERE/web" && npm ci && npm run build)
(cd "$HERE/shell" && cargo build --release --locked)

install -Dm755 "$HERE/shell/target/release/shrimp-setup" "$D/usr/bin/shrimp-setup"
install -d "$D/usr/share/shrimp-setup/ui"
cp -a "$HERE/web/dist/." "$D/usr/share/shrimp-setup/ui/"
install -Dm755 "$HERE/system/share/post-install.sh" "$D/usr/share/shrimp-setup/post-install.sh"
install -Dm644 "$HERE/system/share/drivers.conf" "$D/usr/share/shrimp-setup/drivers.conf"
install -Dm755 "$HERE/system/libexec/shrimp-setup-apply" "$D/usr/libexec/shrimp-setup-apply"
install -Dm644 "$HERE/system/polkit/org.shrimp.setup.policy" "$D/usr/share/polkit-1/actions/org.shrimp.setup.policy"
install -Dm644 "$HERE/system/polkit/50-shrimp-setup.rules" "$D/usr/share/polkit-1/rules.d/50-shrimp-setup.rules"
install -Dm644 "$HERE/system/autostart/shrimp-setup-first-boot.desktop" "$D/etc/xdg/autostart/shrimp-setup-first-boot.desktop"
install -Dm644 "$HERE/system/systemd/shrimp-nvidia-flatpak.service" "$D/usr/lib/systemd/system/shrimp-nvidia-flatpak.service"
install -Dm644 "$HERE/system/agama/shrimp.yaml" "$D/usr/share/agama/products.d/shrimp.yaml"

install -Dm755 "$ROOT/standardize/shrimp-app-style" "$D/usr/bin/shrimp-app-style"
install -Dm644 "$ROOT/standardize/shrimp-app-style.service" "$D/usr/lib/systemd/system/shrimp-app-style.service"
install -Dm644 "$ROOT/standardize/shrimp-app-style.path" "$D/usr/lib/systemd/system/shrimp-app-style.path"
install -Dm644 "$ROOT/standardize/shrimp-app-style-user.service" "$D/usr/lib/systemd/user/shrimp-app-style-user.service"

if [ "$LIVE" = --live ]; then
  install -Dm644 "$HERE/system/autostart/shrimp-setup-install.desktop" "$D/etc/xdg/autostart/shrimp-setup-install.desktop"
  install -Dm644 "$HERE/system/systemd/agama-web-server.service.d/50-shrimp.conf" "$D/usr/lib/systemd/system/agama-web-server.service.d/50-shrimp.conf"
  install -Dm644 "$HERE/system/systemd/shrimp-setup-token.service" "$D/usr/lib/systemd/system/shrimp-setup-token.service"
fi
echo "Setup Shrimp zainstalowany w $D"
