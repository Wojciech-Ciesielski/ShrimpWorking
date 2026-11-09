# Fragment config.sh boxa panko (chroot obrazu; składa go shrimp-box).
# Panko's cleanup timer does nothing until /etc/panko/panko.conf exists (the setting is off by default).
[ -x /usr/bin/panko ] || die "panko missing (box panko was not installed)"
systemctl enable panko-cleanup.timer
