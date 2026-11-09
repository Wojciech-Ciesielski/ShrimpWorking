#!/bin/bash
# Linu(x) 3/3: aplikacje Qt, Electron i GTK3 z Flathub w wyglądzie GTK4/libadwaita.
# Logika jest w /usr/bin/shrimp-app-style (box app-style w repo, boxes/app-style):
# globalne nadpisania flatpak (QT_STYLE_OVERRIDE=Adwaita, dekoracje okien Qt adwaita, portal,
# Electron na Waylandzie), rozszerzenia z Flathub po instalacji każdej aplikacji.
set -uo pipefail
. /usr/share/shrimp/linux/build/common
if [ ! -x /usr/bin/shrimp-app-style ]; then
  warn "brak /usr/bin/shrimp-app-style (kontener bez boxa app-style?)"
  exit 0
fi
# nadpisania globalne zapisujemy już w obrazie (bez sieci; aplikacji jeszcze nie ma)
/usr/bin/shrimp-app-style || warn "shrimp-app-style zakończył się błędem"
flatpak override --system --show >&2 || true
systemctl enable shrimp-app-style.path || warn "nie można włączyć shrimp-app-style.path"
systemctl --global enable shrimp-app-style-user.service || warn "nie można włączyć shrimp-app-style-user.service"
exit 0
