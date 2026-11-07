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
# KIWI description = kiwi/ plus files kept elsewhere in the repo
rm -rf out/desc && cp -a kiwi out/desc
install -Dm755 standardize/shrimp-app-style out/desc/root/usr/bin/shrimp-app-style
install -Dm644 standardize/shrimp-app-style.service out/desc/root/usr/lib/systemd/system/shrimp-app-style.service
install -Dm644 standardize/shrimp-app-style.path out/desc/root/usr/lib/systemd/system/shrimp-app-style.path
install -Dm644 standardize/shrimp-app-style-user.service out/desc/root/usr/lib/systemd/user/shrimp-app-style-user.service
# LinU(x) build scripts add this repo if KIWI left none configured inside the image
echo "$REPO/" > out/desc/root/usr/share/shrimp/linux/build/repo.url
"$ENGINE" run --rm --privileged -v /dev:/dev -v "$PWD:/work" -w /work \
  docker.io/opensuse/tumbleweed:latest bash -euxc "
    zypper -n --gpg-auto-import-keys ref
    zypper -n in --no-recommends python3-kiwi kiwi-systemdeps-iso-media kiwi-systemdeps-bootloaders kiwi-systemdeps-filesystems binutils findutils gawk sed coreutils
    rm -rf out/build
    kiwi-ng --logfile out/kiwi.log --color-output system build \
      --description out/desc --set-repo '$REPO' --target-dir out/build
    mv out/build/*.iso out/
    # Adwaita icon sources used by the boot themes, printed for design previews
    for n in go-next-symbolic changes-prevent-symbolic system-lock-screen-symbolic network-wireless-signal-excellent-symbolic \\
             audio-volume-high-symbolic battery-level-100-symbolic system-shutdown-symbolic; do
      f=\$(find out/build/build/image-root/usr/share/icons/Adwaita -name \"\$n.svg\" -print -quit)
      [ -n \"\$f\" ] && echo \"ICON-SVG \$n \$(base64 -w0 \"\$f\")\" || true
    done
    grep -h 'GRUB fonts\|WARNING\|extension installed\|optional package installed\|config.sh\|LinU(x)' out/kiwi.log | tail -40 || true
    rm -rf out/build out/desc
  "
ls -lh out/*.iso
