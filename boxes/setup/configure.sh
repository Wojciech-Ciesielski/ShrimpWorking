# Fragment config.sh boxa setup (chroot obrazu; składa go shrimp-box). BOX_ARGS = argumenty z kontenera.
[ -x /usr/bin/shrimp-setup ] || die "shrimp-setup missing (box setup was not installed)"
if [[ " $BOX_ARGS " == *" --live "* ]]; then
  # Shrimp Setup on the live medium: Agama (installer back end) serves the Setup UI,
  # shrimp-setup-token.service hands its token to the live user, the window starts from
  # /etc/xdg/autostart/shrimp-setup-install.desktop.
  [ -f /etc/xdg/autostart/shrimp-setup-install.desktop ] || die "Setup autostart missing"
  systemctl enable agama.service agama-web-server.service shrimp-setup-token.service
  # Sesja shrimp-setup dla logowania automatycznego (live-session ustawia AutomaticLogin=shrimp).
  [ -f /usr/share/wayland-sessions/shrimp-setup.desktop ] || die "shrimp-setup session missing"
  install -d -m 0700 /var/lib/AccountsService/users
  printf '[User]\nSession=shrimp-setup\nSystemAccount=false\n' > /var/lib/AccountsService/users/shrimp
  if [ -f /etc/gdm/custom.conf ] && ! grep -q '^DefaultSession=' /etc/gdm/custom.conf; then
    sed -i 's/^\[daemon\]$/[daemon]\nDefaultSession=shrimp-setup.desktop/' /etc/gdm/custom.conf
  fi
  glib-compile-schemas /usr/share/glib-2.0/schemas
fi
