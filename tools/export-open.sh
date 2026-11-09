#!/bin/bash
# Przygotowuje czyste drzewo do repozytorium otwartego: bez wyników testów, śladów prywatnego repo i sekretów.
# Użycie: tools/export-open.sh KATALOG_DOCELOWY [ref]   (domyślnie HEAD; katalog musi być pusty albo nie istnieć)
# Skrypt niczego nie wysyła: kopiuje pliki i wypisuje raport. Historii git nie przenosi (zaczynamy od czystego commitu).
set -euo pipefail
dst="${1:?podaj katalog docelowy}"
ref="${2:-HEAD}"
cd "$(git rev-parse --show-toplevel)"
if [ -e "$dst" ] && [ -n "$(ls -A "$dst" 2>/dev/null)" ]; then echo "katalog $dst nie jest pusty" >&2; exit 1; fi
mkdir -p "$dst"

# Starsze refy mogą jeszcze mieć test-results/ (zrzuty z CI); do repozytorium otwartego nie trafiają.
git archive "$ref" | tar -x -C "$dst" --exclude='./test-results'
rm -rf "$dst/test-results"

echo "== Wzorce sekretów"
if grep -rIEn '(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16})' "$dst"; then
  echo "ZNALEZIONO możliwe sekrety: usuń je i zmień klucze przed publikacją" >&2; exit 2
else
  echo "brak"
fi

echo "== Ślady prywatnego repozytorium i danych osobowych (do ręcznej decyzji)"
grep -rIn -e 'Wojciech' -e 'ShrimpWorking' -e '@icloud.com' "$dst" --exclude-dir=node_modules | head -20 || true

echo "== Licencje"
[ -f "$dst/LICENSE" ] || echo "BRAK LICENSE w korzeniu: wybierz licencję Shrimp (fork Rufusa w boxes/shrimp-install/rufus jest na GPLv3, więc ta część zostaje GPLv3)"
[ -f "$dst/boxes/shrimp-install/rufus/LICENSE.txt" ] && echo "ok: boxes/shrimp-install/rufus/LICENSE.txt" || echo "BRAK: boxes/shrimp-install/rufus/LICENSE.txt"

echo "== Pliki powyżej 50 MB"
find "$dst" -type f -size +50M -print

echo "gotowe: $dst"
