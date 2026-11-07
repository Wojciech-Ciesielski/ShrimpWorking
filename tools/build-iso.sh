#!/bin/bash
# Builds the Shrimp live ISO with KIWI inside an openSUSE Tumbleweed container.
# Usage: tools/build-iso.sh [leap-version]   (default 16.1). Needs Docker or Podman and ~20 GB free.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="${1:-${LEAP_VERSION:-16.1}}"
ENGINE="$(command -v podman || command -v docker)"

base="https://download.opensuse.org/distribution/leap/${VERSION}/repo/oss"
REPO=""
for candidate in "$base/x86_64" "$base"; do
  if curl -fsSLI "$candidate/repodata/repomd.xml" >/dev/null 2>&1; then REPO="$candidate"; break; fi
done
[ -n "$REPO" ] || { echo "openSUSE Leap ${VERSION} repository not found under $base" >&2; exit 1; }
echo "Using repository: $REPO"

mkdir -p out
"$ENGINE" run --rm --privileged -v /dev:/dev -v "$PWD:/work" -w /work \
  docker.io/opensuse/tumbleweed:latest bash -euxc "
    zypper -n --gpg-auto-import-keys ref
    zypper -n in --no-recommends python3-kiwi kiwi-systemdeps-iso-media kiwi-systemdeps-bootloaders kiwi-systemdeps-filesystems binutils findutils gawk sed coreutils
    rm -rf out/build
    kiwi-ng --logfile out/kiwi.log --color-output system build \
      --description kiwi --set-repo '$REPO' --target-dir out/build
    mv out/build/*.iso out/
    # Adwaita icon sources used by the boot themes, printed for design previews
    for n in go-next-symbolic changes-prevent-symbolic system-lock-screen-symbolic network-wireless-signal-excellent-symbolic \\
             audio-volume-high-symbolic battery-level-100-symbolic system-shutdown-symbolic; do
      f=\$(find out/build/build/image-root/usr/share/icons/Adwaita -name \"\$n.svg\" -print -quit)
      [ -n \"\$f\" ] && echo \"ICON-SVG \$n \$(base64 -w0 \"\$f\")\" || true
    done
    grep -h 'GRUB fonts\|WARNING\|extension installed\|optional package installed\|config.sh' out/kiwi.log | tail -40 || true
    rm -rf out/build
  "
ls -lh out/*.iso
