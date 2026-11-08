#!/usr/bin/env python3
"""Boot the Shrimp live ISO in QEMU and capture screenshots of every stage.

Usage: qemu-test.py <iso> <outdir> <mode>
  mode: uefi        full run: silent GRUB (no menu), Plymouth, desktop, extensions, lock screen, GDM, shutdown
        secureboot  OVMF with Microsoft keys enrolled, F4 opens the hidden GRUB menu, boot stages only
        bios        SeaBIOS, F4 opens the hidden GRUB menu, boot stages only

Screenshots are taken through QMP (screendump), keys and clicks are injected
through QMP too, and diagnostics typed into a terminal in the live session are
written to the serial port (<outdir>/serial.log).
"""
import hashlib
import json
import os
import shutil
import socket
import subprocess
import sys
import time

ISO, OUT, MODE = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
QMP_SOCK = os.path.join(OUT, "qmp.sock")
W, H = 1920, 1080

# ---------------------------------------------------------------- qemu ----
cmd = [
    "qemu-system-x86_64", "-enable-kvm", "-cpu", "host", "-smp", "4", "-m", "6144",
    "-device", f"virtio-vga,edid=on,xres={W},yres={H}",
    "-device", "qemu-xhci", "-device", "usb-tablet", "-device", "usb-kbd",
    "-nic", "user,model=virtio-net-pci",
    "-cdrom", ISO, "-boot", "d",
    "-display", "none",
    "-qmp", f"unix:{QMP_SOCK},server=on,wait=off",
    "-serial", f"file:{os.path.join(OUT, 'serial.log')}",
]
if MODE in ("uefi", "secureboot"):
    if MODE == "uefi":
        code, vars_ = "/usr/share/OVMF/OVMF_CODE_4M.fd", "/usr/share/OVMF/OVMF_VARS_4M.fd"
        cmd += ["-machine", "q35"]
    else:
        code, vars_ = "/usr/share/OVMF/OVMF_CODE_4M.secboot.fd", "/usr/share/OVMF/OVMF_VARS_4M.ms.fd"
        cmd += ["-machine", "q35,smm=on", "-global", "driver=cfi.pflash01,property=secure,value=on"]
    local_vars = os.path.join(OUT, "vars.fd")
    shutil.copy(vars_, local_vars)
    cmd += ["-drive", f"if=pflash,format=raw,unit=0,readonly=on,file={code}",
            "-drive", f"if=pflash,format=raw,unit=1,file={local_vars}"]
else:
    cmd += ["-machine", "q35"]

print("+", " ".join(cmd), flush=True)
qemu = subprocess.Popen(cmd)
T0 = time.time()


def t():
    return time.time() - T0


class VMGone(Exception):
    """QEMU exited (e.g. the guest powered off)."""


class QMP:
    def __init__(self, path):
        for _ in range(100):
            try:
                self.s = socket.socket(socket.AF_UNIX)
                self.s.connect(path)
                break
            except OSError:
                time.sleep(0.1)
        else:
            raise SystemExit("QMP socket never appeared")
        self.f = self.s.makefile("rw")
        self.f.readline()  # greeting
        self.cmd("qmp_capabilities")

    def cmd(self, name, **args):
        msg = {"execute": name}
        if args:
            msg["arguments"] = args
        try:
            self.f.write(json.dumps(msg) + "\n")
            self.f.flush()
        except OSError:  # BrokenPipeError etc.: QEMU already exited (the guest powered off)
            raise VMGone()
        while True:
            line = self.f.readline()
            if not line:
                raise VMGone()
            r = json.loads(line)
            if "return" in r:
                return r["return"]
            if "error" in r:
                print("QMP error:", name, r["error"], flush=True)
                return None


qmp = QMP(QMP_SOCK)

# ---------------------------------------------------------- screenshots ----
shots = []
_last_hash = None
_seq = 0


def shot(label, keep_duplicates=False):
    """Screendump to PNG; consecutive identical frames are dropped."""
    global _last_hash, _seq
    if qemu.poll() is not None:
        return
    tmp = os.path.join(OUT, "tmp.png")
    if qmp.cmd("screendump", filename=tmp, format="png") is None:
        return
    for _ in range(50):
        if os.path.exists(tmp) and os.path.getsize(tmp) > 0:
            break
        time.sleep(0.05)
    h = hashlib.sha1(open(tmp, "rb").read()).hexdigest()
    if h == _last_hash and not keep_duplicates:
        os.remove(tmp)
        return
    _last_hash = h
    _seq += 1
    name = f"{_seq:03d}-{int(t()):04d}s-{label}.png"
    os.rename(tmp, os.path.join(OUT, name))
    shots.append(name)
    print(f"[{t():6.1f}s] shot {name}", flush=True)


def wait_shooting(until, every, label):
    while t() < until and qemu.poll() is None:
        nxt = t() + every
        shot(label)
        while t() < nxt:
            time.sleep(0.05)


# ---------------------------------------------------------------- input ----
SHIFTED = {'|': 'backslash', '>': 'dot', '<': 'comma', '&': '7', '"': 'apostrophe',
           '_': 'minus', ':': 'semicolon', '*': '8', '(': '9', ')': '0', '~': 'grave_accent',
           '$': '4', '@': '2', '{': 'bracket_left', '}': 'bracket_right', '!': '1',
           '?': 'slash', '+': 'equal', '%': '5', '^': '6', '#': '3'}
PLAIN = {' ': 'spc', '-': 'minus', '/': 'slash', '.': 'dot', ';': 'semicolon', "'": 'apostrophe',
         '=': 'equal', ',': 'comma', '\n': 'ret', '\\': 'backslash', '[': 'bracket_left',
         ']': 'bracket_right', '`': 'grave_accent', '\t': 'tab'}


def _key_events(names, down):
    return [{"type": "key", "data": {"down": down, "key": {"type": "qcode", "data": n}}} for n in names]


def press(names):
    """Press a chord: modifiers down in order, then released in reverse, one event at a time
    (send-key overran the guest keyboard queue and left Shift stuck)."""
    for n in names:
        qmp.cmd("input-send-event", events=_key_events([n], True))
        time.sleep(0.03)
    for n in reversed(names):
        qmp.cmd("input-send-event", events=_key_events([n], False))
        time.sleep(0.03)
    time.sleep(0.06)


def keys(*names):
    print(f"[{t():6.1f}s] keys {'+'.join(names)}", flush=True)
    press(list(names))
    time.sleep(0.2)


def type_text(s):
    print(f"[{t():6.1f}s] type {s!r}", flush=True)
    for c in s:
        if c.isalpha() and c.isupper():
            k = ["shift", c.lower()]
        elif c.isalnum():
            k = [c]
        elif c in PLAIN:
            k = [PLAIN[c]]
        elif c in SHIFTED:
            k = ["shift", SHIFTED[c]]
        else:
            raise ValueError(f"no key for {c!r}")
        press(k)


def click(x, y):
    print(f"[{t():6.1f}s] click {x},{y}", flush=True)
    ax, ay = int(x * 32767 / (W - 1)), int(y * 32767 / (H - 1))
    qmp.cmd("input-send-event", events=[
        {"type": "abs", "data": {"axis": "x", "value": ax}},
        {"type": "abs", "data": {"axis": "y", "value": ay}}])
    time.sleep(0.2)
    for down in (True, False):
        qmp.cmd("input-send-event", events=[{"type": "btn", "data": {"down": down, "button": "left"}}])
        time.sleep(0.1)


def pause(sec):
    time.sleep(sec)


def run_dialog(command):
    keys("alt", "f2")
    pause(2)
    type_text(command)
    pause(0.5)
    keys("ret")


# ----------------------------------------------------------------- plan ----
try:
    if MODE != "uefi":
        # The menu is hidden (1 s); F4 during that second must open it. F4 does nothing in
        # SeaBIOS/OVMF (Esc would open their own menus), so tap it from power-on.
        while t() < 25 and qemu.poll() is None:
            press(["f4"])
            shot("grub-f4")
            time.sleep(0.25)
        shot("grub-menu", keep_duplicates=True)
        keys("ret")
    # Normal start: no GRUB menu, no boot text, then the Plymouth splash. Dense frames.
    wait_shooting(45, 1, "boot")
    if MODE != "uefi":
        wait_shooting(240, 5, "boot")
        raise SystemExit(0)

    # Live session: GDM autologin into GNOME (software rendering, so be patient).
    wait_shooting(150, 10, "session")
    # Shrimp Setup opens full screen on its own once Agama is up (autostart, shrimp-setup --install).
    wait_shooting(t() + 90, 10, "setup")
    shot("setup", keep_duplicates=True)
    # Close it for the desktop checks below (the window itself refuses to close).
    run_dialog("pkill -f shrimp-setup")
    pause(5)
    shot("desktop", keep_duplicates=True)

    # Shrimp Menu: the logo, first item on the left of the top bar.
    click(20, 16)
    pause(3)
    shot("shrimp-menu", keep_duplicates=True)
    keys("esc")
    pause(2)

    # Quick Settings (system menu): status icons on the right of the top bar.
    click(W - 30, 16)
    pause(3)
    shot("quick-settings", keep_duplicates=True)
    keys("esc")
    pause(2)

    # Overview (Super): Blur my Shell, dash, workspaces.
    keys("meta_l")
    pause(4)
    shot("overview", keep_duplicates=True)
    keys("esc")
    pause(3)

    # Terminal with diagnostics; everything is copied to the serial port.
    run_dialog("kgx")
    pause(8)
    shot("terminal", keep_duplicates=True)
    type_text("sudo -v\n")
    pause(3)
    type_text("shrimp\n")
    pause(3)
    diag = (
        "{ echo ===EXT; gnome-extensions list --details; echo ===SHELL; "
        "sudo journalctl -b _UID=$(id -u) -o short-monotonic --no-pager | grep -iE 'gnome-shell|extension|JS ERROR|ding' | tail -n 300; "
        "echo ===SETUP; ls -l /usr/bin/shrimp-setup /etc/xdg/autostart/shrimp-setup-install.desktop /run/shrimp-setup /run/agama; "
        "systemctl status --no-pager agama-web-server agama shrimp-setup-token | head -n 60; "
        "sudo journalctl -b -o short-monotonic --no-pager | grep -iE 'shrimp-setup|agama|webkit' | tail -n 150; "
        "echo ===FAILED; systemctl --failed --no-pager; echo ===END; } 2>&1 | sudo tee /dev/ttyS0 >/dev/null\n"
    )
    type_text(diag)
    pause(15)
    shot("terminal-diag", keep_duplicates=True)
    type_text("exit\n")
    pause(3)

    # Lock screen: clock, then the password prompt, then unlock.
    keys("meta_l", "l")
    pause(4)
    shot("lock-blank", keep_duplicates=True)
    keys("shift")  # wake the screen: the clock, no password prompt yet
    pause(3)
    shot("lock", keep_duplicates=True)
    pause(3)
    shot("lock", keep_duplicates=True)
    keys("spc")
    pause(3)
    shot("lock-password", keep_duplicates=True)
    type_text("shrimp")
    pause(1)
    shot("lock-password-typed", keep_duplicates=True)
    keys("ret")
    pause(6)
    shot("unlocked", keep_duplicates=True)

    # Log out to see the GDM greeter.
    run_dialog("gnome-session-quit --logout --no-prompt")
    wait_shooting(t() + 30, 3, "gdm")
    shot("gdm", keep_duplicates=True)

    # Power off from the greeter: Plymouth shutdown splash.
    qmp.cmd("system_powerdown")
    wait_shooting(t() + 6, 1, "powerdown")
    keys("ret")  # confirm a power-off dialog if one appears
    wait_shooting(t() + 60, 1, "shutdown")
except VMGone:
    print(f"[{t():6.1f}s] QEMU exited", flush=True)
finally:
    if qemu.poll() is None:
        try:
            qmp.cmd("quit")
        except VMGone:
            pass
        qemu.wait(10)
    with open(os.path.join(OUT, "shots.json"), "w") as f:
        json.dump(shots, f, indent=1)
    for p in ("tmp.png", "vars.fd", "qmp.sock"):
        try:
            os.remove(os.path.join(OUT, p))
        except OSError:
            pass
    print(f"{len(shots)} screenshots in {OUT}", flush=True)
