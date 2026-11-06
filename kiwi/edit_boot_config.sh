#!/bin/bash
# KIWI editbootconfig hook (runs on the build host, cwd = image root).
# $1 = "iso:<media dir>". Shapes the live ISO GRUB menu to the design:
#   Shrimp / Computer settings (UEFI firmware, translated), Shrimp theme fonts, 1920x1080.
# Menu language: boot/grub2/shrimp-lang.cfg on the media (written by Shrimp Install from the Windows
# language) sets shrimp_lang; themes/shrimp/lang/<tag>.cfg (tools/render-grub-i18n.js) has the entry
# name and whether it must be an image; no file or unknown language means English.
set -euo pipefail
media="${1#iso:}"
theme_txt="$(find "$media" -path '*/themes/shrimp/theme.txt' -print -quit)"
[ -n "$theme_txt" ] || { echo "edit_boot_config: theme not found in $media" >&2; exit 1; }
theme_dir="$(dirname "$theme_txt")"

# two-entry live menu layout
cp "$theme_dir/theme-live.txt" "$theme_txt"
# Secure Boot (lockdown) variant: text as images, see theme-live-sb.txt
cp "$theme_dir/theme-live-sb.txt" "$theme_dir/theme-sb.txt"
# one theme per language: only the countdown text differs (theme text cannot be translated at boot)
[ -f "$theme_dir/lang/timeouts.tsv" ] || { echo "edit_boot_config: $theme_dir/lang/timeouts.tsv missing" >&2; exit 1; }
while IFS=$'\t' read -r tag text; do
  [ -n "$tag" ] || continue
  for pair in "theme.txt:theme-$tag.txt" "theme-sb.txt:theme-sb-$tag.txt"; do
    awk -v t="$text" '/^  text = / { print "  text = \"" t "\""; next } { print }' \
      "$theme_dir/${pair%%:*}" > "$theme_dir/${pair##*:}"
  done
done < "$theme_dir/lang/timeouts.tsv"

# Under Secure Boot (lockdown) the signed GRUB refuses unsigned font files
# ("prohibited by secure boot policy"), so fonts and the text theme are used only outside lockdown;
# with lockdown (or for scripts Inter has no glyphs for, shrimp_img=1) the image-based
# theme-sb-<tag>.txt is used (no fonts needed).
fontlines=""
for f in "$theme_dir"/*.pf2; do
  fontlines="${fontlines}        loadfont (\$root)/boot/grub2/themes/shrimp/$(basename "$f")"$'\n'
done

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
      print "    menuentry \"${shrimp_fw}\" --class efi-${shrimp_lang} --unrestricted {"
      print "        fwsetup"
      print "    }"
      print "fi"
    }
  ' "$cfg" > "$cfg.new"
  # language, theme fonts, and the 1920x1080 mode the theme is drawn for
  sed -i -e "s|^\(\s*\)set gfxmode=.*|\1set gfxmode=1920x1080,auto|" "$cfg.new"
  FONTLINES="$fontlines" awk '
    /^[ \t]*set theme=.*themes\/shrimp\/theme\.txt/ {
      pre = $0; sub(/^[ \t]*set theme=/, "", pre); sub(/theme\.txt$/, "", pre)
      print "if [ -f ($root)/boot/grub2/shrimp-lang.cfg ]; then"
      print "    source ($root)/boot/grub2/shrimp-lang.cfg"
      print "fi"
      print "if [ -f ($root)/boot/grub2/themes/shrimp/lang/${shrimp_lang}.cfg ]; then"
      print "    source ($root)/boot/grub2/themes/shrimp/lang/${shrimp_lang}.cfg"
      print "else"
      print "    set shrimp_lang=en"
      print "fi"
      print "if [ \"${lockdown}\" != \"y\" -a \"${shrimp_img}\" != \"1\" ]; then"
      printf "%s", ENVIRON["FONTLINES"]
      print "    set theme=" pre "theme-${shrimp_lang}.txt"
      print "else"
      print "    set theme=" pre "theme-sb-${shrimp_lang}.txt"
      print "fi"
      next
    }
    NR == 1 { print "set shrimp_lang=en"; print "set shrimp_fw=\"Computer settings\""; print "set shrimp_img=0" }
    { print }
  ' "$cfg.new" > "$cfg.new2" && mv "$cfg.new2" "$cfg.new"
  mv "$cfg.new" "$cfg"
  patched=$((patched + 1))
  echo "edit_boot_config: patched $cfg"
  grep -n 'menuentry\|loadfont\|gfxmode\|theme\|shrimp_' "$cfg" || true
done < <(find "$media" -name grub.cfg)
[ "$patched" -gt 0 ] || { echo "edit_boot_config: no grub.cfg with menu entries in $media" >&2; exit 1; }
