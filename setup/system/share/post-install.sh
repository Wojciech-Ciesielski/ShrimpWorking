#!/bin/bash
# Skrypt Agamy po instalacji (scripts.post, chroot: false). System docelowy jest w /mnt.
# Ustawia pierwsze uruchomienie Shrimp: jednorazowe logowanie automatyczne nowego konta,
# znacznik dla shrimp-setup --first-boot, pliki przeniesione przez Shrimp Install i jego wpis UEFI.
set -euo pipefail
T=/mnt
STATE=$T/var/lib/shrimp-setup
SRC=/usr/share/shrimp-setup
log() { echo "shrimp-post-install: $*"; }

mkdir -p "$STATE"
USER_NAME=$(sed -n 's/.*"userName":"\([^"]*\)".*/\1/p' "$STATE/install.json")
[ -n "$USER_NAME" ] || { log "brak userName w install.json"; exit 1; }

# Dopóki pakietu shrimp-setup nie ma w repozytorium, kopiujemy Setup z nośnika do systemu.
if ! chroot "$T" rpm -q shrimp-setup >/dev/null 2>&1; then
  log "kopiuję Setup z nośnika"
  install -Dm755 /usr/bin/shrimp-setup "$T/usr/bin/shrimp-setup"
  install -Dm755 /usr/libexec/shrimp-setup-apply "$T/usr/libexec/shrimp-setup-apply"
  install -Dm755 /usr/bin/shrimp-app-style "$T/usr/bin/shrimp-app-style"
  mkdir -p "$T$SRC" && cp -a "$SRC/ui" "$SRC/drivers.conf" "$T$SRC/"
  install -Dm644 /usr/share/polkit-1/actions/org.shrimp.setup.policy "$T/usr/share/polkit-1/actions/org.shrimp.setup.policy"
  install -Dm644 /usr/share/polkit-1/rules.d/50-shrimp-setup.rules "$T/usr/share/polkit-1/rules.d/50-shrimp-setup.rules"
  install -Dm644 /etc/xdg/autostart/shrimp-setup-first-boot.desktop "$T/etc/xdg/autostart/shrimp-setup-first-boot.desktop"
  install -Dm644 /usr/lib/systemd/system/shrimp-app-style.service "$T/usr/lib/systemd/system/shrimp-app-style.service"
  install -Dm644 /usr/lib/systemd/system/shrimp-app-style.path "$T/usr/lib/systemd/system/shrimp-app-style.path"
  install -Dm644 /usr/lib/systemd/user/shrimp-app-style-user.service "$T/usr/lib/systemd/user/shrimp-app-style-user.service"
  install -Dm644 /usr/lib/systemd/system/shrimp-nvidia-flatpak.service "$T/usr/lib/systemd/system/shrimp-nvidia-flatpak.service"
  chroot "$T" systemctl enable shrimp-app-style.path shrimp-nvidia-flatpak.service || true
  chroot "$T" systemctl --global enable shrimp-app-style-user.service || true
fi

# Sklep Shrimp (Shrimp Apps) instaluje zestaw podstawowy i programy z onboardingu; jego pakietu też jeszcze nie ma.
if ! chroot "$T" rpm -q shrimp-apps >/dev/null 2>&1 && [ -x /usr/bin/shrimp-apps ]; then
  log "kopiuję Shrimp Apps z nośnika"
  install -Dm755 /usr/bin/shrimp-apps "$T/usr/bin/shrimp-apps"
  install -Dm644 /usr/share/applications/org.shrimp.Apps.desktop "$T/usr/share/applications/org.shrimp.Apps.desktop"
  install -Dm644 /usr/share/metainfo/org.shrimp.Apps.metainfo.xml "$T/usr/share/metainfo/org.shrimp.Apps.metainfo.xml"
  install -Dm644 /usr/share/shrimp/base-apps.json "$T/usr/share/shrimp/base-apps.json"
fi

# Pakiety GNOME zastąpione przez Shrimp Apps, Cocktail i Flatpaki z zestawu podstawowego: usuwamy je teraz,
# póki system docelowy jest jeszcze zapisywalny, i blokujemy, żeby aktualizacje ich nie przywracały.
# Firefox i aplikacje GNOME wracają jako Flatpaki ze sklepu Shrimp przy pierwszej konfiguracji.
LIST=$SRC/remove-packages.txt
if [ -f "$LIST" ]; then
  while IFS= read -r pkg; do
    case "$pkg" in ''|'#'*) continue;; esac
    chroot "$T" zypper -n --no-refresh rm --no-confirm "$pkg" >/dev/null 2>&1 || true
    chroot "$T" zypper -n al "$pkg" >/dev/null 2>&1 || true
  done < "$LIST"
  log "usunięto zastąpione pakiety GNOME"
fi
# Firefox z Flatpaka jest domyślną przeglądarką, zanim się zainstaluje (wpis nieszkodliwy bez niego).
mkdir -p "$T/etc/xdg"
cat > "$T/etc/xdg/mimeapps.list" <<'MIME'
[Default Applications]
x-scheme-handler/http=org.mozilla.firefox.desktop
x-scheme-handler/https=org.mozilla.firefox.desktop
text/html=org.mozilla.firefox.desktop
application/xhtml+xml=org.mozilla.firefox.desktop
MIME

# Cichy start zainstalowanego systemu: menu GRUB ukryte (Esc, F4 lub F8 w ciągu sekundy je pokazuje,
# pod BIOS także wciśnięty Shift), bez komunikatów „Loading Linux/initial ramdisk” i bez logów jądra.
GRUB_REGEN=0
DEF=$T/etc/default/grub
if [ -f "$DEF" ]; then
  setkey() {
    if grep -q "^$1=" "$DEF"; then sed -i "s|^$1=.*|$1=$2|" "$DEF"; else echo "$1=$2" >> "$DEF"; fi
  }
  setkey GRUB_TIMEOUT 1
  setkey GRUB_TIMEOUT_STYLE hidden
  setkey GRUB_HIDDEN_TIMEOUT_QUIET true
  CMD=$(sed -n 's/^GRUB_CMDLINE_LINUX_DEFAULT="\(.*\)"$/\1/p' "$DEF" | head -n1)
  for o in quiet splash=silent loglevel=3 rd.udev.log_level=3 udev.log_level=3 systemd.show_status=false rd.systemd.show_status=false vt.global_cursor_default=0; do
    case " $CMD " in *" ${o%%=*}="*|*" $o "*) ;; *) CMD="$CMD $o";; esac
  done
  setkey GRUB_CMDLINE_LINUX_DEFAULT "\"${CMD# }\""
  GRUB_REGEN=1
  log "GRUB: ukryte menu, cichy start"
fi
# 10_linux wypisuje echo przed jądrem i initrd; plik jest %config, więc aktualizacja zostawi .rpmnew.
if [ -f "$T/etc/grub.d/10_linux" ]; then
  sed -i "/^[[:space:]]*echo[[:space:]]*'\$(echo \"\$message\" | grub_quote)'/d" "$T/etc/grub.d/10_linux"
  GRUB_REGEN=1
fi

# Pulpit Shrimp jak na nośniku: rozszerzenia (Menu Shrimp, dok…), ustawienia domyślne
# (99_shrimp.gschema.override), tapeta i logo. Leap nie ma tych rozszerzeń w pakietach.
log "kopiuję wygląd pulpitu Shrimp"
EXT=/usr/share/gnome-shell/extensions
SCH=/usr/share/glib-2.0/schemas
for d in "$EXT"/*/; do
  uuid=$(basename "$d")
  [ -e "$T$EXT/$uuid" ] || cp -a "$d" "$T$EXT/$uuid"
done
for f in "$SCH"/org.gnome.shell.extensions.*.gschema.xml; do
  [ -f "$f" ] && { [ -e "$T$f" ] || install -Dm644 "$f" "$T$f"; }
done
install -Dm644 "$SCH/99_shrimp.gschema.override" "$T$SCH/99_shrimp.gschema.override"
for p in /usr/share/backgrounds/shrimp /usr/share/gnome-background-properties/shrimp.xml /usr/share/shrimp/logo \
         /usr/share/icons/hicolor/scalable/apps/shrimp-logo.svg /usr/share/icons/hicolor/scalable/apps/shrimp-logo-dark.svg \
         /usr/share/icons/hicolor/scalable/apps/shrimp-logo-symbolic.svg /usr/share/icons/MoreWaita; do
  [ -e "$p" ] && { mkdir -p "$T$(dirname "$p")"; cp -a "$p" "$T$(dirname "$p")/"; }
done
chroot "$T" glib-compile-schemas "$SCH" || log "glib-compile-schemas nie powiodło się"
chroot "$T" gtk-update-icon-cache -f /usr/share/icons/hicolor >/dev/null 2>&1 || true
chroot "$T" gtk-update-icon-cache -f /usr/share/icons/MoreWaita >/dev/null 2>&1 || true

# GRUB w języku konta: nazwa wpisu „Computer settings” (i18n/grub, motyw Shrimp: lang/<znacznik>.cfg).
# Wpis firmware GRUB-a w docelowym systemie pochodzi z pakietu (angielski), więc podmieniamy go tutaj.
grub_tag() {
  local l="${1%%.*}" mod="" p r
  case "$l" in *@*) mod="${l#*@}"; l="${l%%@*}";; esac
  p="${l%%_*}"; r=""; case "$l" in *_*) r="${l#*_}";; esac
  case "$p" in
    zh) case "$r" in TW|HK|MO) echo zh-hant;; *) echo zh-hans;; esac;;
    pt) [ "$r" = PT ] && echo pt-pt || echo pt-br;;
    sr) [ "$mod" = latin ] && echo sr-latn || echo sr-cyrl;;
    uz) [ "$mod" = cyrillic ] && echo uz-cyrl || echo uz;;
    be) [ "$mod" = latin ] && echo be-latn || echo be;;
    ca) [ "$mod" = valencia ] && echo ca-valencia || echo ca;;
    no) echo nb;;
    *) echo "$p";;
  esac
}
SYS_LANG=$(sed -n 's/^LANG=//p' "$T/etc/locale.conf" 2>/dev/null | tr -d '"' | head -n1)
TAG=$(grub_tag "${SYS_LANG:-en}")
FW=$(sed -n 's/^set shrimp_fw="\(.*\)"$/\1/p' "/usr/share/grub2/themes/shrimp/lang/$TAG.cfg" 2>/dev/null | head -n1)
if [ -n "$FW" ] && [ -f "$T/etc/grub.d/30_uefi-firmware" ]; then
  sed -i "s|UEFI Firmware Settings|$FW|" "$T/etc/grub.d/30_uefi-firmware"
  log "GRUB: wpis firmware w języku $TAG"
  GRUB_REGEN=1
fi
if [ "$GRUB_REGEN" = 1 ]; then
  chroot "$T" grub2-mkconfig -o /boot/grub2/grub.cfg >/dev/null 2>&1 || log "grub2-mkconfig nie powiodło się (zmiany GRUB wejdą przy jego następnej aktualizacji)"
fi

# Pierwsza konfiguracja: znacznik + jednorazowe logowanie automatyczne (zdejmuje je shrimp-setup-apply).
touch "$STATE/first-boot"
if [ -f "$T/etc/sysconfig/displaymanager" ]; then
  sed -i "s/^DISPLAYMANAGER_AUTOLOGIN=.*/DISPLAYMANAGER_AUTOLOGIN=\"$USER_NAME\"/" "$T/etc/sysconfig/displaymanager"
fi
mkdir -p "$T/etc/gdm"
cat > "$T/etc/gdm/custom.conf" <<CONF
# Shrimp: logowanie automatyczne tylko na pierwszą konfigurację (zdejmuje je shrimp-setup-apply).
[daemon]
AutomaticLoginEnable=True
AutomaticLogin=$USER_NAME
CONF

# Bez gnome-initial-setup: jego kroki robi Setup Shrimp.
HOME_DIR=$(chroot "$T" getent passwd "$USER_NAME" | cut -d: -f6)
OWNER=$(chroot "$T" id -u "$USER_NAME"):$(chroot "$T" id -g "$USER_NAME")
install -d -o "${OWNER%:*}" -g "${OWNER#*:}" "$T$HOME_DIR/.config"
touch "$T$HOME_DIR/.config/gnome-initial-setup-done"
chown "$OWNER" "$T$HOME_DIR/.config/gnome-initial-setup-done"

# Flathub dla całego systemu (instalacja programów w kroku Programy).
chroot "$T" flatpak remote-add --system --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo || \
  log "Flathub zostanie dodany przy pierwszej konfiguracji"

# Pliki i lista programów z Shrimp Install (shrimp-transfer/ na nośniku): foldery Windows trafiają do
# folderów XDG nowego konta w jego języku, pliki podzielone (> 4 GB) są sklejane, shrimp.json idzie do $STATE.
if /usr/bin/shrimp-setup --restore --root "$T" --user "$USER_NAME"; then :; else
  log "bez plików z Shrimp Install"
fi

# Jednorazowy wpis UEFI „Shrimp Install” (BootNext z Windows) nie jest już potrzebny.
if command -v efibootmgr >/dev/null && [ -d /sys/firmware/efi ]; then
  for B in $(efibootmgr | sed -n 's/^Boot\([0-9A-Fa-f]\{4\}\)[* ]*Shrimp Install\b.*/\1/p'); do
    efibootmgr -q -b "$B" -B && log "usunięto wpis UEFI Boot$B (Shrimp Install)"
  done
fi
log "gotowe"
