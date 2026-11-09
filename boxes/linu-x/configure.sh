# Fragment config.sh boxa linu-x (chroot obrazu; składa go shrimp-box).
# Linu(x): official NVIDIA driver, PipeWire codecs, libadwaita look for Qt/Electron
# (scripts in /usr/share/shrimp/linux/build, see linux.conf there; failures are WARNING lines).
# build/common adds the build repository from repo.url when KIWI left none configured in the image.
[ -n "${SHRIMP_REPO:-}" ] && echo "$SHRIMP_REPO/" > /usr/share/shrimp/linux/build/repo.url
for s in /usr/share/shrimp/linux/build/*.sh; do
  echo "config.sh: Linu(x) $(basename "$s")"
  bash "$s"
done
if [ -f /tmp/shrimp-build-oss ]; then
  zypper --non-interactive removerepo shrimp-build-oss || true
fi
rm -rf /usr/share/shrimp/linux/build /tmp/shrimp-build-oss
