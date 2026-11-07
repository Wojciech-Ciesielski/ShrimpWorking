#!/bin/bash
# Builds Shrimp Setup for the live ISO and installs it into DESTDIR (setup/install.sh --live).
# The Rust window (GTK4 + WebKitGTK 6) is compiled in a Leap chroot made from the same
# repository as the ISO, so it links against exactly the libraries the image ships.
# Runs as root inside the openSUSE container of tools/build-iso.sh (needs nodejs + npm there).
#   tools/build-setup.sh REPO_URL DESTDIR
set -euo pipefail
REPO=${1:?usage: build-setup.sh REPO_URL DESTDIR}
DEST=${2:?usage: build-setup.sh REPO_URL DESTDIR}
cd "$(dirname "$0")/.."
ROOT=$PWD
BR=${SHRIMP_BUILDROOT:-/var/tmp/shrimp-setup-buildroot}

# 1. Leap build root
if [ ! -x "$BR/usr/bin/rustup" ] || [ ! -x "$BR/usr/bin/gawk" ]; then
  rm -rf "$BR"; mkdir -p "$BR"
  zypper -n --root "$BR" ar -f "$REPO" leap
  zypper -n --root "$BR" --gpg-auto-import-keys ref
  zypper -n --root "$BR" --gpg-auto-import-keys in --no-recommends \
    bash coreutils findutils gawk gcc pkg-config rustup ca-certificates ca-certificates-mozilla \
    'pkgconfig(gtk4)' 'pkgconfig(webkitgtk-6.0)'
fi
cp -L /etc/resolv.conf "$BR/etc/resolv.conf"
cleanup() { umount -l "$BR/proc" "$BR/dev" "$BR/sys" 2>/dev/null || true; }
trap cleanup EXIT
mount --bind /dev "$BR/dev"; mount -t proc proc "$BR/proc"; mount -t sysfs sys "$BR/sys"

# 2. Rust window
rm -rf "$BR/src/shell"; mkdir -p "$BR/src"
cp -a "$ROOT/setup/shell" "$BR/src/shell"
rm -rf "$BR/src/shell/target"
chroot "$BR" /bin/bash -euxc '
  export HOME=/root CARGO_HOME=/root/.cargo RUSTUP_HOME=/root/.rustup
  rustup toolchain list | grep -q stable || rustup default stable
  cd /src/shell && cargo build --release --locked
'
mkdir -p "$ROOT/setup/shell/target/release"
cp "$BR/src/shell/target/release/shrimp-setup" "$ROOT/setup/shell/target/release/shrimp-setup"
echo "shrimp-setup libraries (packages the ISO must contain):"
chroot "$BR" /bin/bash -c "ldd /src/shell/target/release/shrimp-setup | awk '/=>/ {print \$3}' \
  | xargs -r rpm -qf --qf '%{NAME}\n' 2>/dev/null | sort -u | sed 's/^/  /'" || true

# 3. Web UI (platform independent) + install into DESTDIR
SHRIMP_SETUP_PREBUILT=1 setup/install.sh "$DEST" --live
