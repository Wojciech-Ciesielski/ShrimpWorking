# Fragment config.sh boxa setup (chroot obrazu; składa go shrimp-box). BOX_ARGS = argumenty z kontenera.
[ -x /usr/bin/shrimp-setup ] || die "shrimp-setup missing (box setup was not installed)"
if [[ " $BOX_ARGS " == *" --live "* ]]; then
  # Shrimp Setup on the live medium: Agama (installer back end) serves the Setup UI,
  # shrimp-setup-token.service hands its token to the live user, the window starts from
  # /etc/xdg/autostart/shrimp-setup-install.desktop.
  [ -f /etc/xdg/autostart/shrimp-setup-install.desktop ] || die "Setup autostart missing"
  systemctl enable agama.service agama-web-server.service shrimp-setup-token.service
fi
