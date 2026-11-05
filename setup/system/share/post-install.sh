#!/bin/bash
# Skrypt Agamy po instalacji (scripts.post, chroot: false). System docelowy jest w /mnt.
# Ustawia pierwsze uruchomienie Shrimp: jednorazowe logowanie automatyczne nowego konta,
# znacznik dla shrimp-setup --first-boot i pliki przeniesione przez Shrimp Install.
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
  chroot "$T" systemctl enable shrimp-app-style.path || true
  chroot "$T" systemctl --global enable shrimp-app-style-user.service || true
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

# Pliki i lista programów z Shrimp Install (na nośniku, jeśli były przeniesione).
for TR in /run/initramfs/live/shrimp-transfer /run/media/*/SHRIMP*/shrimp-transfer; do
  [ -d "$TR" ] || continue
  log "przywracam pliki z $TR"
  [ -f "$TR/windows-apps.json" ] && install -m644 "$TR/windows-apps.json" "$STATE/windows-apps.json"
  if [ -d "$TR/files" ]; then
    cp -a "$TR/files/." "$T$HOME_DIR/"
    chown -R "$OWNER" "$T$HOME_DIR"
  fi
  break
done
log "gotowe"
