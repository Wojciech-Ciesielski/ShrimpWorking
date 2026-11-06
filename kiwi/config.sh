#!/bin/bash
# Shrimp image configuration (runs chrooted inside the image root, after packages and root/).
set -euxo pipefail

test -f /.kconfig && . /.kconfig
test -f /.profile && . /.profile

die() { echo "config.sh: $*" >&2; exit 1; }

#--------------------------------------
# Branding: os-release (GNOME Settings › O systemie), GRUB name
#--------------------------------------
if [ -f /usr/lib/os-release ]; then
  rm -f /etc/os-release
  sed -e 's/^NAME=.*/NAME="Shrimp"/' \
      -e 's/^PRETTY_NAME=.*/PRETTY_NAME="Shrimp Beta"/' \
      -e 's/^LOGO=.*/LOGO="shrimp-logo"/' \
      /usr/lib/os-release > /etc/os-release
  grep -q '^LOGO=' /etc/os-release || echo 'LOGO="shrimp-logo"' >> /etc/os-release
fi
gtk-update-icon-cache -f /usr/share/icons/hicolor || true

#--------------------------------------
# Fonts
#--------------------------------------
fc-cache -f

#--------------------------------------
# Icons for the boot themes: real Adwaita symbolic icons (DESIGN.md §10), recoloured
#--------------------------------------
adw_icon() {
  local f
  for name in "$@"; do
    f="$(find /usr/share/icons/Adwaita -name "${name}.svg" -print -quit)"
    [ -n "$f" ] && { echo "$f"; return 0; }
  done
  return 1
}
css_color() { printf '* { fill: %s !important; color: %s !important; }\n' "$1" "$1" > /tmp/icon.css; echo /tmp/icon.css; }

next_svg="$(adw_icon go-next-symbolic)" || die "go-next-symbolic not found"
lock_svg="$(adw_icon changes-prevent-symbolic system-lock-screen-symbolic channel-secure-symbolic)" || die "lock icon not found"

PLY=/usr/share/plymouth/themes/shrimp
# lock: 1.6% of width (30.72 px at 1920), colour dim #8c8c8c; arrow: same size, black on the white circle
rsvg-convert -w 31 -h 31 -s "$(css_color '#8c8c8c')" -o "$PLY/lock.png" "$lock_svg"
rsvg-convert -w 62 -h 62 -s "$(css_color '#8c8c8c')" -o "$PLY/lock@2x.png" "$lock_svg"
rsvg-convert -w 31 -h 31 -s "$(css_color '#000000')" -o "$PLY/arrow.png" "$next_svg"
rsvg-convert -w 62 -h 62 -s "$(css_color '#000000')" -o "$PLY/arrow@2x.png" "$next_svg"

GRUBTHEME=/usr/share/grub2/themes/shrimp
# hanging chevron: 36 px glyph, 17 px gap to the text, item height 77, glyph top at 20 px
rsvg-convert -w 36 -h 36 --page-width 54 --page-height 77 --left 0 --top 20 \
  -s "$(css_color '#ffffff')" -o "$GRUBTHEME/select_w.png" "$next_svg"

#--------------------------------------
# GRUB fonts (Inter → PF2) and theme font names
#--------------------------------------
pf2_name() {
  # PF2: "FILE" len "PFF2" "NAME" <be32 len> <name\0>
  local len
  len=$(od -An -tu1 -j16 -N4 "$1" | awk '{print $1*16777216+$2*65536+$3*256+$4}')
  dd if="$1" bs=1 skip=20 count="$len" 2>/dev/null | tr -d '\0'
}
INTER=/usr/share/fonts/truetype/inter
grub2-mkfont -s 38 -o "$GRUBTHEME/inter-regular-38.pf2" "$INTER/Inter-Regular.ttf"
# SemiBold needs its own family name, otherwise GRUB names it "Inter Regular 38" too
grub2-mkfont -n "Inter SemiBold" -s 38 -o "$GRUBTHEME/inter-semibold-38.pf2" "$INTER/Inter-SemiBold.ttf"
grub2-mkfont -s 27 -o "$GRUBTHEME/inter-regular-27.pf2" "$INTER/Inter-Regular.ttf"
r38="$(pf2_name "$GRUBTHEME/inter-regular-38.pf2")"
s38="$(pf2_name "$GRUBTHEME/inter-semibold-38.pf2")"
r27="$(pf2_name "$GRUBTHEME/inter-regular-27.pf2")"
echo "GRUB fonts: '$r38' '$s38' '$r27'"
[ "$r38" != "$s38" ] || die "GRUB regular and semibold fonts have the same name"
for t in "$GRUBTHEME/theme.txt" "$GRUBTHEME/theme-live.txt"; do
  sed -i -e "s|@FONT_REGULAR_38@|$r38|g" -e "s|@FONT_SEMIBOLD_38@|$s38|g" -e "s|@FONT_REGULAR_27@|$r27|g" "$t"
done

# installed-system GRUB defaults (used once Shrimp is installed to disk)
if [ -f /etc/default/grub ]; then
  sed -i -e 's|^GRUB_DISTRIBUTOR=.*|GRUB_DISTRIBUTOR="Shrimp"|' \
         -e 's|^GRUB_TIMEOUT=.*|GRUB_TIMEOUT=5|' \
         -e 's|^GRUB_THEME=.*|GRUB_THEME=/boot/grub2/themes/shrimp/theme.txt|' \
         -e 's|^GRUB_GFXMODE=.*|GRUB_GFXMODE=1920x1080,auto|' /etc/default/grub
  grep -q '^GRUB_THEME=' /etc/default/grub || echo 'GRUB_THEME=/boot/grub2/themes/shrimp/theme.txt' >> /etc/default/grub
  grep -q '^GRUB_GFXMODE=' /etc/default/grub || echo 'GRUB_GFXMODE=1920x1080,auto' >> /etc/default/grub
fi
# menu names from specs/grub.md
[ -f /etc/grub.d/30_uefi-firmware ] && sed -i 's/UEFI Firmware Settings/Computer settings/' /etc/grub.d/30_uefi-firmware || true
for f in /etc/grub.d/80_suse_btrfs_snapshot /usr/lib/snapper/plugins/grub /etc/grub.d/*snapshot*; do
  [ -f "$f" ] && sed -i 's/Start bootloader from a read-only snapshot/Previous system versions/' "$f" || true
done

#--------------------------------------
# Plymouth
#--------------------------------------
plymouth-set-default-theme shrimp

#--------------------------------------
# GNOME Shell theme: GDM background + lock screen (appended to every shell stylesheet)
#--------------------------------------
RES=/usr/share/gnome-shell/gnome-shell-theme.gresource
[ -f "$RES" ] || die "$RES not found"
work="$(mktemp -d)"
for r in $(gresource list "$RES"); do
  mkdir -p "$work$(dirname "$r")"
  gresource extract "$RES" "$r" > "$work$r"
done
prefix=/org/gnome/shell/theme
ls "$work$prefix"
found=0
for css in "$work$prefix"/gnome-shell*.css; do
  [ -f "$css" ] || continue
  cat /usr/share/shrimp/shell/shrimp.css >> "$css"
  found=1
done
[ "$found" = 1 ] || die "no gnome-shell*.css in $RES"
cp /usr/share/shrimp/shell/gdm-background.jpg "$work$prefix/shrimp-gdm-background.jpg"
{
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  echo "<gresources><gresource prefix=\"$prefix\">"
  (cd "$work$prefix" && find . -type f | sed 's|^\./||' | sort | sed 's|.*|<file>&</file>|')
  echo '</gresource></gresources>'
} > "$work/theme.gresource.xml"
glib-compile-resources --sourcedir="$work$prefix" --target="$RES" "$work/theme.gresource.xml"
rm -rf "$work"

#--------------------------------------
# GNOME Shell extensions from extensions.gnome.org
# (Leap 16 does not ship Light Style, Apps Menu or Workspace Indicator in a package,
#  so they come from extensions.gnome.org as well)
#--------------------------------------
SHELL_MAJOR="$(rpm -q --qf '%{VERSION}' gnome-shell | cut -d. -f1)"
EXT=/usr/share/gnome-shell/extensions
install_ext() {
  local uuid="$1" info url
  info="$(curl -fsSL "https://extensions.gnome.org/extension-info/?uuid=${uuid}&shell_version=${SHELL_MAJOR}")" || return 1
  url="$(echo "$info" | sed -n 's/.*"download_url": *"\([^"]*\)".*/\1/p')"
  [ -n "$url" ] || return 1
  curl -fsSL -o "/tmp/${uuid}.zip" "https://extensions.gnome.org${url}" || return 1
  rm -rf "${EXT:?}/${uuid}"
  mkdir -p "$EXT/$uuid"
  unzip -q -o "/tmp/${uuid}.zip" -d "$EXT/$uuid"
  rm -f "/tmp/${uuid}.zip"
  # Extension.getSettings() prefers the extension's own schemas/ directory, and an
  # override only applies to schemas compiled next to it (that is why Just Perfection
  # kept the Activities button). Compile our override into the local directory too.
  if [ -d "$EXT/$uuid/schemas" ]; then
    cp "$EXT/$uuid"/schemas/*.gschema.xml /usr/share/glib-2.0/schemas/
    cp /usr/share/glib-2.0/schemas/99_shrimp.gschema.override "$EXT/$uuid/schemas/"
    glib-compile-schemas "$EXT/$uuid/schemas" 2>&1 | grep -v 'No such schema' || true
  fi
  chmod -R a+rX "$EXT/$uuid"
  echo "extension installed: $uuid"
}
for uuid in ding@rastersoft.com blur-my-shell@aunetx dash-to-dock@micxgx.gmail.com just-perfection-desktop@just-perfection \
            apps-menu@gnome-shell-extensions.gcampax.github.com workspace-indicator@gnome-shell-extensions.gcampax.github.com; do
  [ -d "$EXT/$uuid" ] || install_ext "$uuid" || die "extension $uuid has no release for GNOME $SHELL_MAJOR"
done
# Light Style: optional, newer shells follow the light colour scheme on their own
uuid=light-style@gnome-shell-extensions.gcampax.github.com
if [ ! -d "$EXT/$uuid" ] && ! install_ext "$uuid"; then
  echo "WARNING: $uuid has no release for GNOME $SHELL_MAJOR; the shell follows color-scheme instead"
fi
ls "$EXT"
glib-compile-schemas /usr/share/glib-2.0/schemas

#--------------------------------------
# GDM settings database
#--------------------------------------
dconf update

#--------------------------------------
# Apps only from Flathub (system-wide remote)
#--------------------------------------
flatpak remote-add --system --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo

#--------------------------------------
# Live session: graphical boot, autologin as "shrimp" (password: shrimp, needed for the lock screen)
#--------------------------------------
systemctl set-default graphical.target
systemctl enable NetworkManager.service
if [ -f /etc/sysconfig/displaymanager ]; then
  sed -i -e 's/^DISPLAYMANAGER=.*/DISPLAYMANAGER="gdm"/' \
         -e 's/^DISPLAYMANAGER_AUTOLOGIN=.*/DISPLAYMANAGER_AUTOLOGIN="shrimp"/' /etc/sysconfig/displaymanager
fi
update-alternatives --set default-displaymanager /usr/lib/X11/displaymanagers/gdm || true
systemctl enable display-manager.service || systemctl enable gdm.service
mkdir -p /etc/gdm
cat > /etc/gdm/custom.conf <<'CONF'
[daemon]
AutomaticLoginEnable=True
AutomaticLogin=shrimp
WaylandEnable=true
CONF
echo 'shrimp ALL=(ALL) ALL' > /etc/sudoers.d/shrimp
chmod 0440 /etc/sudoers.d/shrimp
echo shrimp > /etc/hostname

# remove helpers only needed above
rm -f /tmp/icon.css
exit 0
