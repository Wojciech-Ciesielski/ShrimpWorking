#!/bin/bash
# Przygotowuje to, czego kompilacja Shrimp Install potrzebuje poza kodem:
#  - WebView2 SDK (nagłówek i WebView2Loader.dll, licencja BSD) z NuGet, ze sprawdzeniem sumy,
#  - interfejs: ui/ → jeden plik HTML w rufus/src/shrimp/ui.html.
# Użycie: tools/prepare.sh   (wymaga curl, unzip, node/npm; SKIP_UI=1 pomija interfejs)
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
dst="$here/rufus/src/shrimp"

WV2_VERSION=1.0.4314.35
WV2_SHA256=90778deb1b77e36292828b4b5833c9255c27533f40e0ddd55891ae718944edc4
if [ ! -f "$dst/webview2/include/WebView2.h" ] || [ ! -f "$dst/WebView2Loader.dll" ]; then
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/wv2.nupkg" "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/$WV2_VERSION"
  echo "$WV2_SHA256  $tmp/wv2.nupkg" | sha256sum -c -
  unzip -q -o "$tmp/wv2.nupkg" 'build/native/include/*' 'build/native/x64/WebView2Loader.dll' LICENSE.txt -d "$tmp/x"
  mkdir -p "$dst/webview2/include"
  cp "$tmp/x/build/native/include/"*.h "$dst/webview2/include/"
  cp "$tmp/x/LICENSE.txt" "$dst/webview2/LICENSE.txt"
  cp "$tmp/x/build/native/x64/WebView2Loader.dll" "$dst/WebView2Loader.dll"
  rm -rf "$tmp"
fi

if [ -z "${SKIP_UI:-}" ]; then
  cd "$here/ui"
  [ -d node_modules ] || npm ci --no-audit --no-fund
  npm run build
  cp dist/index.html "$dst/ui.html"
fi
echo "gotowe: $dst/ui.html, $dst/WebView2Loader.dll"
