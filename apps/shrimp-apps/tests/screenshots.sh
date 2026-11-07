#!/bin/bash
# Zrzuty ekranu Shrimp Apps w Xvfb (jasny i ciemny motyw): Odkrywaj, strona aplikacji,
# kategoria, wyszukiwanie, Zainstalowane. Okno 1100×720.
#   tests/screenshots.sh OUTDIR
# Wymaga: Xvfb, xdotool, ImageMagick (import), dbus-run-session.
set -uo pipefail
OUT=${1:?użycie: screenshots.sh OUTDIR}
BIN=${SHRIMP_APPS_BIN:-$(cd "$(dirname "$0")/.." && pwd)/target/debug/shrimp-apps}
mkdir -p "$OUT"
OUT=$(cd "$OUT" && pwd)

shoot() { # schemat prefiks akcje...
  local scheme=$1 prefix=$2; shift 2
  local script
  script=$(mktemp)
  {
    echo "export GSK_RENDERER=cairo GTK_A11Y=none NO_AT_BRIDGE=1 GDK_BACKEND=x11 DISPLAY=:99"
    echo "export ADW_DEBUG_COLOR_SCHEME=prefer-$scheme"
    echo "'$BIN' 2>>'$OUT/app.log' &"
    echo "sleep ${SHRIMP_APPS_WAIT:-20}"
    echo 'WID=$(xdotool search --name "Shrimp Apps" | head -1); xdotool windowmove $WID 0 0; xdotool windowsize $WID 1100 720; sleep 2'
    for a in "$@"; do
      case $a in
        s:*) echo "import -window root '$OUT/$prefix-${a#s:}.png'" ;;
        c:*) xy=${a#c:}; echo "xdotool mousemove ${xy%,*} ${xy#*,} click 1; sleep 4" ;;
        t:*) echo "xdotool type --delay 80 '${a#t:}'; sleep 3" ;;
        k:*) echo "xdotool key ${a#k:}; sleep 2" ;;
      esac
    done
    echo 'kill %1'
  } > "$script"
  Xvfb :99 -screen 0 1100x720x24 >/dev/null 2>&1 &
  local x=$!
  sleep 2
  dbus-run-session -- bash "$script" >/dev/null 2>&1
  kill $x; wait $x 2>/dev/null
  rm -f "$script"
}

for scheme in light dark; do
  # Odkrywaj → pierwsza aplikacja w sekcji Grafika → wstecz
  shoot "$scheme" "$scheme" s:1-odkrywaj c:400,340 s:2-aplikacja \
    c:130,226 s:3-grafika c:130,110 s:4-zainstalowane c:130,689 t:gimp s:5-szukaj
done
ls -l "$OUT"
