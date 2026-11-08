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
if [ ! -x "$BR/usr/bin/rustup" ] || [ ! -x "$BR/usr/bin/gawk" ] || [ ! -f "$BR/usr/lib64/pkgconfig/libadwaita-1.pc" ]; then
  rm -rf "$BR"; mkdir -p "$BR"
  zypper -n --root "$BR" ar -f "$REPO" leap
  zypper -n --root "$BR" --gpg-auto-import-keys ref
  zypper -n --root "$BR" --gpg-auto-import-keys in --no-recommends \
    bash coreutils findutils gawk gcc pkg-config rustup ca-certificates ca-certificates-mozilla \
    'pkgconfig(gtk4)' 'pkgconfig(webkitgtk-6.0)' 'pkgconfig(libadwaita-1)' 'pkgconfig(flatpak)'
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

# 2b. Shrimp Apps (the store that installs the base Flatpaks); needs ../web-apps, so the whole apps/ tree is copied
rm -rf "$BR/src/apps"; mkdir -p "$BR/src/apps"
cp -a "$ROOT/apps/shrimp-apps" "$ROOT/apps/web-apps" "$BR/src/apps/"
mkdir -p "$BR/src/site" && cp "$ROOT/site/help.json" "$BR/src/site/help.json"
rm -rf "$BR/src/i18n"; mkdir -p "$BR/src/i18n" && cp -a "$ROOT/i18n/webapps" "$BR/src/i18n/webapps"
rm -rf "$BR/src/apps/shrimp-apps/target" "$BR/src/apps/web-apps/target"
chroot "$BR" /bin/bash -euxc '
  export HOME=/root CARGO_HOME=/root/.cargo RUSTUP_HOME=/root/.rustup
  cd /src/apps/shrimp-apps && cargo build --release --locked
'
mkdir -p "$ROOT/apps/shrimp-apps/target/release"
cp "$BR/src/apps/shrimp-apps/target/release/shrimp-apps" "$ROOT/apps/shrimp-apps/target/release/shrimp-apps"
echo "shrimp-apps libraries (packages the ISO must contain):"
chroot "$BR" /bin/bash -c "ldd /src/apps/shrimp-apps/target/release/shrimp-apps | awk '/=>/ {print \$3}' \
  | xargs -r rpm -qf --qf '%{NAME}\n' 2>/dev/null | sort -u | sed 's/^/  /'" || true
SHRIMP_APPS_PREBUILT=1 apps/shrimp-apps/install.sh "$DEST"

# 2c. Cocktail (updates: packages, drivers, history) and Panko (snapshots / system restore).
# Both only need gtk4 + libadwaita, already in the build root; Shrimp Menu opens them
# ("Aktualizacje" -> org.shrimp.Cocktail, "Panko" -> org.shrimp.Panko).
for app in cocktail panko; do
  rm -rf "$BR/src/apps/$app"; cp -a "$ROOT/apps/$app" "$BR/src/apps/$app"; rm -rf "$BR/src/apps/$app/target"
  chroot "$BR" /bin/bash -euxc "
    export HOME=/root CARGO_HOME=/root/.cargo RUSTUP_HOME=/root/.rustup
    cd /src/apps/$app && cargo build --release --locked
  "
  mkdir -p "$ROOT/apps/$app/target/release"
  cp "$BR/src/apps/$app/target/release/$app" "$ROOT/apps/$app/target/release/$app"
done
COCKTAIL_PREBUILT=1 apps/cocktail/install.sh "$DEST"
PANKO_PREBUILT=1 apps/panko/install.sh "$DEST"

# 3. Web UI (platform independent) + install into DESTDIR
SHRIMP_SETUP_PREBUILT=1 setup/install.sh "$DEST" --live
