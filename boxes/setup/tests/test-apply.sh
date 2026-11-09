#!/bin/bash
# Test shrimp-setup-apply na atrapach zypper/transactional-update/mokutil i sztucznym sysfs.
#   setup/tests/test-apply.sh
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
APPLY=$HERE/../system/libexec/shrimp-setup-apply
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin" "$T/state"
LOG=$T/log
# zypper: „search” znajduje pakiety z listy $T/avail, reszta poleceń jest zapisywana.
cat > "$T/bin/zypper" <<Z
#!/bin/bash
if [[ " \$* " == *" search "* ]]; then grep -qx "\${@: -1}" "$T/avail"; exit; fi
echo "zypper \$*" >> "$LOG"
Z
cat > "$T/bin/transactional-update" <<Z
#!/bin/bash
echo "transactional-update \$1 \$2" >> "$LOG"
[ "\$2" = run ] && { shift 2; "\$@"; }
Z
cat > "$T/bin/mokutil" <<Z
#!/bin/bash
cat "$T/sb" 2>/dev/null
Z
chmod +x "$T/bin/"*
export PATH="$T/bin:$PATH" SHRIMP_STATE=$T/state SHRIMP_SYSFS=$T/sys SHRIMP_DRIVERS_CONF=$HERE/../system/share/drivers.conf

gpu() { rm -rf "$T/sys"; mkdir -p "$T/sys/bus/pci/devices/0000:01:00.0"; local d=$T/sys/bus/pci/devices/0000:01:00.0; echo 0x10de > "$d/vendor"; echo 0x030000 > "$d/class"; echo "$1" > "$d/device"; }
run() { : > "$LOG"; touch "$T/state/first-boot"; "$APPLY" "$@" 2>>"$T/stderr"; }
fail() { echo "FAIL: $*"; echo "--- log"; cat "$LOG"; echo "--- stderr"; tail -5 "$T/stderr"; exit 1; }

# 1. RTX 3060 (Turing+), G07 dostępne: otwarty sterownik G07 + kodeki, jedna migawka, restart.
gpu 0x2504
printf '%s\n' openSUSE-repos-Leap-NVIDIA nvidia-open-driver-G07-signed-kmp-meta nvidia-video-G07 nvidia-gl-G07 nvidia-compute-utils-G07 \
  pipewire-pulseaudio mozilla-openh264 > "$T/avail"
OUT=$(run --codecs yes --nvidia nvidia)
[ "$OUT" = reboot ] || fail "1: brak reboot"
[ "$(grep -c '^transactional-update' "$LOG")" = 1 ] || fail "1: więcej niż jedna migawka"
grep -q 'install --auto-agree-with-licenses nvidia-open-driver-G07-signed-kmp-meta nvidia-video-G07 nvidia-gl-G07 nvidia-compute-utils-G07' "$LOG" || fail "1: G07"
grep -q 'install --no-recommends pipewire-pulseaudio mozilla-openh264' "$LOG" || fail "1: kodeki"
[ -f "$T/state/nvidia-flatpak" ] && [ ! -f "$T/state/first-boot" ] || fail "1: znaczniki"

# 2. Tylko G06 w repozytorium: wybiera G06.
printf '%s\n' nvidia-open-driver-G06-signed-kmp-meta nvidia-video-G06 nvidia-gl-G06 > "$T/avail"
run --codecs no --nvidia nvidia >/dev/null
grep -q 'install --auto-agree-with-licenses nvidia-open-driver-G06-signed-kmp-meta nvidia-video-G06 nvidia-gl-G06$' "$LOG" || fail "2: G06"

# 3. GTX 1060 (Pascal) z Secure Boot: bez sterownika NVIDIA, bez migawki.
gpu 0x1c03; echo "SecureBoot enabled" > "$T/sb"
OUT=$(run --codecs no --nvidia nvidia)
[ -z "$OUT" ] && ! grep -q transactional-update "$LOG" || fail "3: starsza karta z SB"

# 4. GTX 1060 bez Secure Boot: zamknięty G06.
echo "SecureBoot disabled" > "$T/sb"
printf '%s\n' nvidia-driver-G06-kmp-default nvidia-video-G06 nvidia-gl-G06 nvidia-compute-utils-G06 > "$T/avail"
run --codecs no --nvidia nvidia >/dev/null
grep -q 'install --auto-agree-with-licenses nvidia-driver-G06-kmp-default' "$LOG" || fail "4: legacy"

# 5. Wybór „Sterownik otwarty”: nic z NVIDIA.
gpu 0x2504
OUT=$(run --codecs no --nvidia open)
[ -z "$OUT" ] && ! grep -q nvidia "$LOG" || fail "5: otwarty"
echo "test-apply: 5/5 OK"
