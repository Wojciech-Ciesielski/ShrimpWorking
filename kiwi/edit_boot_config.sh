#!/bin/bash
# KIWI editbootconfig hook (runs on the build host, cwd = image root).
# $1 = "iso:<media dir>". Shapes the live ISO GRUB menu to the design:
#   Shrimp / Ustawienia komputera (UEFI firmware), Shrimp theme fonts, 1920x1080.
set -euo pipefail
media="${1#iso:}"
theme_txt="$(find "$media" -path '*/themes/shrimp/theme.txt' -print -quit)"
[ -n "$theme_txt" ] || { echo "edit_boot_config: theme not found in $media" >&2; exit 1; }
theme_dir="$(dirname "$theme_txt")"

# two-entry live menu layout
cp "$theme_dir/theme-live.txt" "$theme_txt"

# One loadfont per font. Under Secure Boot (lockdown) the signed GRUB only accepts a font file
# named unicode.pf2, so every font lives in its own directory under that name (kiwi/config.sh).
fonts=""
for f in $(cd "$theme_dir" && find fonts -name unicode.pf2 | sort); do
  fonts="${fonts}loadfont (\$root)/boot/grub2/themes/shrimp/${f}\n"
done
[ -n "$fonts" ] || { echo "edit_boot_config: no theme fonts found in $theme_dir" >&2; exit 1; }

patched=0
# BIOS (boot/grub2) and EFI (EFI/BOOT, EFI/Linux) copies of the menu
while IFS= read -r cfg; do
  grep -q '^menuentry ' "$cfg" || continue
  # drop "Boot from Hard Disk" and "Failsafe", add the firmware settings entry after the first menuentry
  awk '
    /^menuentry "(Boot from Hard Disk|Failsafe)/ { skip = 1 }
    skip { if ($0 ~ /^}/) { skip = 0 } ; next }
    { print }
    /^menuentry / && !added { inentry = 1 }
    inentry && /^}/ {
      inentry = 0; added = 1
      print "if [ \"${grub_platform}\" = \"efi\" ]; then"
      print "    menuentry \"Ustawienia komputera\" --class efi --unrestricted {"
      print "        fwsetup"
      print "    }"
      print "fi"
    }
  ' "$cfg" > "$cfg.new"
  # load the theme fonts and prefer the 1920x1080 mode the theme is drawn for
  sed -i \
    -e "s|^\(\s*\)set gfxmode=.*|\1set gfxmode=1920x1080,auto|" \
    -e "s|^\(\s*\)set theme=\(.*themes/shrimp/theme.txt\)|${fonts}\1set theme=\2|" \
    "$cfg.new"
  mv "$cfg.new" "$cfg"
  patched=$((patched + 1))
  echo "edit_boot_config: patched $cfg"
  grep -n 'menuentry\|loadfont\|gfxmode\|theme' "$cfg" || true
done < <(find "$media" -name grub.cfg)
[ "$patched" -gt 0 ] || { echo "edit_boot_config: no grub.cfg with menu entries in $media" >&2; exit 1; }
