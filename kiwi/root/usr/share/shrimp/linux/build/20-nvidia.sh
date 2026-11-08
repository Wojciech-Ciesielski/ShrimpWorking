#!/bin/bash
# LinU(x) 1/3: oficjalny sterownik NVIDIA na nośniku i w zainstalowanym systemie.
# Moduł jądra: otwarte moduły NVIDIA zbudowane i podpisane przez SUSE (repozytorium Leap),
# więc ładują się przy włączonym Secure Boot bez MOK. Biblioteki (GL, Vulkan, VA-API/NVDEC,
# CUDA): repozytorium NVIDIA dla openSUSE, które zostaje w systemie i daje aktualizacje.
# Karty sprzed Turinga zostają przy nouveau: decyduje /usr/libexec/shrimp-gpu-gate.
set -uo pipefail
. /usr/share/shrimp/linux/build/common
ensure_repos || { warn "sterownik NVIDIA pominięty"; exit 0; }

. /usr/lib/os-release
repo=""; repo_cfg=""
for v in "$VERSION_ID" "${VERSION_ID%%.*}.0"; do
  url="$NVIDIA_REPO_BASE/$v/"
  if curl -fsSLI "${url}repodata/repomd.xml" >/dev/null 2>&1; then
    repo="$url"
    # repozytorium dla tej samej wersji: adres z $releasever, żeby szło za aktualizacją Leap
    if [ "$v" = "$VERSION_ID" ]; then repo_cfg="$NVIDIA_REPO_BASE/\$releasever/"; else repo_cfg="$url"; fi
    break
  fi
done
if [ -z "$repo" ]; then
  warn "repozytorium NVIDIA dla Leap $VERSION_ID niedostępne; sterownik NVIDIA pominięty"
  exit 0
fi
"${ZYP[@]}" addrepo --refresh --priority 90 "$repo_cfg" NVIDIA
"${ZYP[@]}" refresh NVIDIA || { warn "nie można odświeżyć repozytorium NVIDIA"; exit 0; }
note "repozytorium NVIDIA: $repo"

# Co jest w repozytoriach (do logu budowy, żeby było widać nazwy pakietów, gdy coś nie pasuje).
note "pakiety NVIDIA w repozytoriach: $("${ZYP[@]}" -q se -t package 'nvidia-open-driver*' 'nvidia-video*' 'nvidia-gl*' 'nvidia-compute-utils*' 'nvidia-driver*' 2>/dev/null | awk -F'|' 'NR>2 {gsub(/ /,"",$2); print $2}' | sort -u | tr '\n' ' ')"
avail() { "${ZYP[@]}" -q se -x -t package "$1" >/dev/null 2>&1; }

installed=""
for S in $NVIDIA_OPEN_SERIES; do
  kmp=""
  for k in "nvidia-open-driver-$S-signed-kmp-meta" "nvidia-open-driver-$S-signed-kmp-default"; do
    avail "$k" && { kmp=$k; break; }
  done
  [ -n "$kmp" ] || { warn "seria $S: brak podpisanego modułu (nvidia-open-driver-$S-signed-kmp-*)"; continue; }
  pkgs="$kmp"
  for p in $(echo "$NVIDIA_OPEN_PACKAGES" | sed "s/@S@/$S/g"); do
    case "$p" in *kmp*) continue ;; esac
    if avail "$p"; then pkgs="$pkgs $p"; else warn "seria $S: brak pakietu $p"; fi
  done
  note "seria $S: instaluję $pkgs"
  # shellcheck disable=SC2086
  if out=$("${ZYP[@]}" install --no-recommends --auto-agree-with-licenses $pkgs 2>&1); then
    installed=$S; break
  fi
  echo "$out" | tail -25 | sed 's/^/LinU(x): zypper: /' >&2
  warn "seria $S nie zainstalowała się, próbuję następnej"
done
if [ -z "$installed" ]; then
  warn "żadna seria otwartego sterownika NVIDIA ($NVIDIA_OPEN_SERIES) się nie zainstalowała"
  exit 0
fi
note "sterownik NVIDIA $installed zainstalowany: $(rpm -qa 'nvidia-open-driver*' 'nvidia-gl*' | tr '\n' ' ')"

# Pakiety NVIDIA wyłączają nouveau całkowicie (blacklist). Na nośniku dla każdego sprzętu
# o nouveau decyduje shrimp-gpu-gate (Turing+ → nvidia, starsze → nouveau), więc blacklist
# zamieniamy na tę bramkę. Pliki z /usr/lib nadpisujemy kopią w /etc o tej samej nazwie.
for f in /etc/modprobe.d/*.conf /usr/lib/modprobe.d/*.conf; do
  [ -f "$f" ] || continue
  grep -qE '^[[:space:]]*blacklist[[:space:]]+nouveau' "$f" || continue
  dst="/etc/modprobe.d/$(basename "$f")"
  [ "$f" = "$dst" ] || cp "$f" "$dst"
  sed -i -E 's/^([[:space:]]*blacklist[[:space:]]+nouveau.*)$/# \1  (Shrimp: decyduje shrimp-gpu-gate)/' "$dst"
  sed -i -E 's/^([[:space:]]*options[[:space:]]+nouveau[[:space:]]+modeset=0.*)$/# \1/' "$dst"
  note "nouveau odblokowane w $dst"
done
cat > /etc/modprobe.d/60-shrimp-gpu.conf <<'CONF'
# Shrimp LinU(x): karty NVIDIA od Turinga (GTX 16xx, RTX 20xx i nowsze) dostają oficjalny
# sterownik, starsze nouveau. Wymuszenie nouveau: parametr jądra shrimp.nouveau=1.
install nouveau /usr/libexec/shrimp-gpu-gate
# Wayland w GDM i GNOME, konsola przez sterownik NVIDIA, pamięć karty zachowana przy uśpieniu.
options nvidia-drm modeset=1 fbdev=1
options nvidia NVreg_PreserveVideoMemoryAllocations=1
CONF
# GDM włącza Wayland na NVIDIA tylko z usługami uśpienia sterownika.
for u in nvidia-suspend.service nvidia-resume.service nvidia-hibernate.service nvidia-suspend-then-hibernate.service; do
  systemctl enable "$u" 2>/dev/null || true
done
echo "$installed" > /usr/share/shrimp/linux/nvidia-series
exit 0
