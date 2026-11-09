#!/bin/bash
# Zapisuje wyniki testu z CI (zrzuty, dzienniki) na osobnej gałęzi `wyniki-testow`,
# a nie na gałęzi z kodem. Dzięki temu main i gałęzie PR nie rosną od commitów botów.
#
# Użycie (w workflow, po actions/checkout): tools/ci-wyniki.sh RODZAJ KATALOG
#   RODZAJ   np. iso, install, shrimp-apps; wyniki trafiają do <gałąź>/<RODZAJ>/ na gałęzi wyników
#   KATALOG  katalog z plikami do zapisania (jego zawartość zastępuje poprzedni wynik)
#
# Gałąź wyników ma osobną historię (orphan). Można ją w każdej chwili usunąć, następny przebieg
# założy ją od nowa. Podgląd: https://github.com/<repo>/tree/wyniki-testow
set -euo pipefail
kind="${1:?podaj rodzaj wyników}"
src="$(realpath "${2:?podaj katalog z wynikami}")"
branch="${SHRIMP_RESULTS_BRANCH:-wyniki-testow}"
ref="${GITHUB_REF_NAME:-$(git rev-parse --abbrev-ref HEAD)}"
dest="$ref/$kind"
run="${GITHUB_RUN_ID:-lokalnie}"
[ -d "$src" ] || { echo "brak katalogu $src" >&2; exit 1; }

git config user.name >/dev/null || git config user.name "github-actions[bot]"
git config user.email >/dev/null || git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

w="$(mktemp -d)"
trap 'git worktree remove --force "$w" 2>/dev/null || rm -rf "$w"' EXIT

for i in 1 2 3 4 5; do
  git worktree remove --force "$w" 2>/dev/null || rm -rf "$w"
  git worktree prune
  if git fetch -q --depth=1 origin "+refs/heads/$branch:refs/remotes/origin/$branch" 2>/dev/null; then
    git worktree add -q --detach "$w" "origin/$branch"
  else
    # Pierwszy zapis: pusta gałąź bez wspólnej historii z kodem.
    git worktree add -q --detach "$w"
    git -C "$w" checkout -q --orphan "$branch-nowa"
    git -C "$w" rm -rfq .
    printf '%s\n' "# Wyniki testów CI" "" \
      "Katalogi: \`<gałąź>/<rodzaj>/\`. Każdy przebieg zastępuje poprzedni wynik tej gałęzi i rodzaju." \
      "Ta gałąź nie ma wspólnej historii z kodem i można ją usunąć w dowolnej chwili." \
      "Zapisuje ją \`tools/ci-wyniki.sh\`." > "$w/README.md"
  fi
  rm -rf "${w:?}/$dest"
  mkdir -p "$w/$dest"
  cp -a "$src"/. "$w/$dest"/
  printf 'run=%s\ncommit=%s\ndata=%s\n' "$run" "${GITHUB_SHA:-$(git rev-parse HEAD)}" "$(date -u +%FT%TZ)" > "$w/$dest/PRZEBIEG.txt"
  git -C "$w" add -A .
  if git -C "$w" diff --cached --quiet; then echo "bez zmian"; exit 0; fi
  git -C "$w" commit -qm "$kind: $ref (run $run) [skip ci]"
  if git -C "$w" push -q origin "HEAD:refs/heads/$branch"; then
    echo "wyniki: $branch/$dest"
    exit 0
  fi
  sleep $((i * 3))
done
echo "nie udało się zapisać wyników na $branch" >&2
exit 1
