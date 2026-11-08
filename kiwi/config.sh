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
  # Linu(x) (Shrimp's layer on top of plain Linux, /usr/share/shrimp/linux) stays out of os-release:
  # the user does not see the name anywhere in the system.
fi
gtk-update-icon-cache -f /usr/share/icons/hicolor || true

#--------------------------------------
# MoreWaita: Shrimp's main icon theme (Adwaita style, adds the app icons Adwaita lacks).
# Not packaged for Leap, so it comes from GitHub: the latest release, or the main branch
# when the API gives no release. MOREWAITA_REF pins a tag/branch. Set as default in
# 99_shrimp.gschema.override (icon-theme='MoreWaita') and for GDM in dconf gdm.d.
#--------------------------------------
MW_DIR=/usr/share/icons/MoreWaita
MW_REF="${MOREWAITA_REF:-}"
if [ -z "$MW_REF" ]; then
  MW_REF="$(curl -fsSL --retry 5 --retry-all-errors --retry-delay 3 https://api.github.com/repos/somepaulo/MoreWaita/releases/latest 2>/dev/null \
            | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n1 || true)"
fi
MW_REF="${MW_REF:-main}"
mw_ok=0
# github.com/archive gives 503 now and then; codeload.github.com serves the same archive, and the
# default branch is the last resort when the release tag cannot be fetched at all.
for url in "https://github.com/somepaulo/MoreWaita/archive/${MW_REF}.zip" \
           "https://codeload.github.com/somepaulo/MoreWaita/zip/refs/tags/${MW_REF}" \
           "https://codeload.github.com/somepaulo/MoreWaita/zip/refs/heads/main"; do
  if curl -fsSL --retry 4 --retry-all-errors --retry-delay 5 -o /tmp/morewaita.zip "$url"; then mw_ok=1; echo "MoreWaita downloaded from $url"; break; fi
  echo "WARNING: MoreWaita download failed: $url"
done
[ "$mw_ok" = 1 ] || die "MoreWaita ${MW_REF}: download failed"
rm -rf /tmp/morewaita "$MW_DIR"
mkdir -p /tmp/morewaita
unzip -q /tmp/morewaita.zip -d /tmp/morewaita
MW_SRC="$(dirname "$(find /tmp/morewaita -maxdepth 2 -name index.theme | head -n1)")"
[ -f "$MW_SRC/index.theme" ] || die "MoreWaita ${MW_REF}: no index.theme in the archive"
mkdir -p "$MW_DIR"
cp -a "$MW_SRC"/. "$MW_DIR"/
# keep only the theme itself (no installer scripts, docs, git metadata)
rm -rf "$MW_DIR"/.git* "$MW_DIR"/*.sh "$MW_DIR"/*.md "$MW_DIR"/*.txt "$MW_DIR"/LICENSE* "$MW_DIR"/meson* "$MW_DIR"/screenshots
grep -q '^Name=MoreWaita' "$MW_DIR/index.theme" || echo "WARNING: MoreWaita index.theme has an unexpected Name= line"
chmod -R a+rX "$MW_DIR"
gtk-update-icon-cache -f "$MW_DIR" || true
rm -rf /tmp/morewaita /tmp/morewaita.zip
echo "icon theme installed: MoreWaita ${MW_REF} ($(find "$MW_DIR" -name '*.svg' | wc -l) icons)"

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
# System menu and system tools (packages that may be missing or renamed in Leap 16.1).
# config.kiwi fails the whole build on an unknown name, so these are optional: the first
# available name of each group is installed (with its -lang package), a missing group is a WARNING.
# The build repository is not part of the image (--set-repo), so it is added here and removed after.
#--------------------------------------
VERSION_ID="$(. /etc/os-release && echo "$VERSION_ID")"
LEAP="https://download.opensuse.org/distribution/leap/${VERSION_ID}/repo/oss"
OPT_REPO=""
for candidate in "$LEAP/x86_64" "$LEAP"; do
  if curl -fsSLI "$candidate/repodata/repomd.xml" >/dev/null 2>&1; then OPT_REPO="$candidate"; break; fi
done
opt_pkg() {
  local p
  for p in "$@"; do
    if zypper -n --gpg-auto-import-keys install --no-recommends "$p" >/dev/null 2>&1; then
      zypper -n --gpg-auto-import-keys install --no-recommends "$p-lang" >/dev/null 2>&1 || true
      echo "optional package installed: $p"
      return 0
    fi
  done
  echo "WARNING: none of these packages is available: $*"
}
if [ -n "$OPT_REPO" ]; then
  zypper -n --gpg-auto-import-keys addrepo -f "$OPT_REPO" shrimp-build-oss
  zypper -n --gpg-auto-import-keys refresh shrimp-build-oss
  opt_pkg gnome-bluetooth                       # Quick Settings: Bluetooth toggle
  opt_pkg typelib-1_0-GnomeBluetooth-3_0
  opt_pkg tuned-ppd power-profiles-daemon       # Quick Settings: power mode
  opt_pkg iio-sensor-proxy                      # Quick Settings: auto-rotate (2-in-1 laptops)
  opt_pkg gnome-system-monitor                  # Shrimp menu: System Monitor
  opt_pkg gnome-disk-utility                    # Shrimp menu: Disks
  opt_pkg gnome-extensions                      # Shrimp menu: Extensions
  opt_pkg baobab                                # app grid: disk usage
  opt_pkg gnome-logs                            # app grid: system log
  opt_pkg gvfs-lang                             # translated "Trash" on the desktop (trash:// display name)
  opt_pkg NetworkManager-lang                   # translated "Wired" in Quick Settings (libnm device names)
  zypper -n removerepo shrimp-build-oss
  zypper -n clean -a
else
  echo "WARNING: Leap ${VERSION_ID} repository not reachable, optional system tools skipped"
fi
for unit in bluetooth.service tuned.service tuned-ppd.service power-profiles-daemon.service; do
  [ -f "/usr/lib/systemd/system/$unit" ] && systemctl enable "$unit" || true
done
# Shrimp Menu logo (symbolic, coloured by the top bar)
gtk-update-icon-cache -f /usr/share/icons/hicolor || true

#--------------------------------------
# GNOME Shell extensions from extensions.gnome.org
# (Leap 16 does not ship Light Style in a package,
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
for uuid in ding@rastersoft.com blur-my-shell@aunetx dash-to-dock@micxgx.gmail.com just-perfection-desktop@just-perfection; do
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
# Linu(x): official NVIDIA driver, PipeWire codecs, libadwaita look for Qt/Electron
# (scripts in /usr/share/shrimp/linux/build, see linux.conf there; failures are WARNING lines)
#--------------------------------------
for s in /usr/share/shrimp/linux/build/*.sh; do
  echo "config.sh: Linu(x) $(basename "$s")"
  bash "$s"
done
if [ -f /tmp/shrimp-build-oss ]; then
  zypper --non-interactive removerepo shrimp-build-oss || true
fi
rm -rf /usr/share/shrimp/linux/build /tmp/shrimp-build-oss

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

# Shrimp Setup on the live medium: Agama (installer back end) serves the Setup UI,
# shrimp-setup-token.service hands its token to the live user, the window starts from
# /etc/xdg/autostart/shrimp-setup-install.desktop.
[ -x /usr/bin/shrimp-setup ] || die "shrimp-setup missing (tools/build-setup.sh did not run)"
[ -f /etc/xdg/autostart/shrimp-setup-install.desktop ] || die "Setup autostart missing"
systemctl enable agama.service agama-web-server.service shrimp-setup-token.service
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
