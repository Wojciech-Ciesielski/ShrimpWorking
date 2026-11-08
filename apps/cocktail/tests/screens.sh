#!/bin/bash
# Zrzuty wszystkich zakładek Cocktail na atrapach zyppera, w motywie jasnym i ciemnym.
#   xvfb-run -s "-screen 0 1000x700x24" apps/cocktail/tests/screens.sh KATALOG [PROGRAM]
set -euo pipefail
OUT=$(mkdir -p "$1" && cd "$1" && pwd)
HERE=$(cd "$(dirname "$0")" && pwd)
BIN=$(realpath "${2:-$HERE/../target/debug/cocktail}")
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
# shellcheck source=fake-system.sh
. "$HERE/fake-system.sh" "$T"
export GDK_BACKEND=x11 GSK_RENDERER=cairo NO_AT_BRIDGE=1
for scheme in light dark; do
  for page in aktualizacje urzadzenia pakiety historia; do
    ADW_DEBUG_COLOR_SCHEME=prefer-$scheme COCKTAIL_PAGE=$page "$BIN" &
    P=$!
    sleep 4
    import -window root "$OUT/$page-$scheme.png"
    kill "$P"; wait "$P" 2>/dev/null || true
  done
done
echo "Zrzuty w $OUT"
