# Fragment config.sh boxa live-session (chroot obrazu; składa go shrimp-box).
# Sesja live: start graficzny, logowanie automatyczne jako „shrimp” (hasło: shrimp, potrzebne do ekranu blokady).
systemctl set-default graphical.target
systemctl enable NetworkManager.service
if [ -f /etc/sysconfig/displaymanager ]; then
  sed -i -e 's/^DISPLAYMANAGER=.*/DISPLAYMANAGER="gdm"/' \
         -e 's/^DISPLAYMANAGER_AUTOLOGIN=.*/DISPLAYMANAGER_AUTOLOGIN="shrimp"/' /etc/sysconfig/displaymanager
fi
update-alternatives --set default-displaymanager /usr/lib/X11/displaymanagers/gdm || true
systemctl enable display-manager.service || systemctl enable gdm.service
mkdir -p /etc/gdm
cat > /etc/gdm/custom.conf <<'CONF'
[daemon]
AutomaticLoginEnable=True
AutomaticLogin=shrimp
WaylandEnable=true
CONF
echo 'shrimp ALL=(ALL) ALL' > /etc/sudoers.d/shrimp
chmod 0440 /etc/sudoers.d/shrimp
echo shrimp > /etc/hostname
