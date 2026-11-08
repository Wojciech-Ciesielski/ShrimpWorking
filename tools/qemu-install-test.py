#!/usr/bin/env python3
"""Install Shrimp in QEMU the way a user does after Shrimp Install, then boot the result.

Usage: qemu-install-test.py <usb.img> <outdir>
  usb.img  FAT32 stick made like Shrimp Install does (ISO files, label SHRIMP_LIVE,
           shrimp-transfer/ with shrimp.json and files) plus shrimp-test/agama-install.sh.

Phase 1 boots the stick (UEFI) with an empty 40 GB disk, waits for the Setup window, then
runs shrimp-test/agama-install.sh, which drives Agama with Setup's own configuration and
logs to the serial port. Phase 2 boots the installed disk and captures the first boot
(Setup, first configuration). Everything lands in <outdir> (screenshots, serial*.log).
"""
import hashlib
import json
import os
import shutil
import socket
import subprocess
import sys
import time

USB, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
QMP_SOCK = os.path.join(OUT, "qmp.sock")
W, H = 1920, 1080
DISK = os.path.join(OUT, "disk.qcow2")
VARS = os.path.join(OUT, "vars.fd")
subprocess.run(["qemu-img", "create", "-f", "qcow2", DISK, "40G"], check=True)
shutil.copy("/usr/share/OVMF/OVMF_VARS_4M.fd", VARS)


def start(phase, with_usb):
    if os.path.exists(QMP_SOCK):
        os.remove(QMP_SOCK)
    cmd = [
        "qemu-system-x86_64", "-enable-kvm", "-cpu", "host", "-smp", "4", "-m", "6144",
        "-machine", "q35",
        "-drive", "if=pflash,format=raw,unit=0,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.fd",
        "-drive", f"if=pflash,format=raw,unit=1,file={VARS}",
        "-device", f"virtio-vga,edid=on,xres={W},yres={H}",
        "-device", "qemu-xhci,id=xhci", "-device", "usb-tablet", "-device", "usb-kbd",
        "-nic", "user,model=virtio-net-pci",
        "-drive", f"file={DISK},if=none,id=hd,format=qcow2", "-device", "virtio-blk-pci,drive=hd,bootindex=2",
        "-display", "none",
        "-qmp", f"unix:{QMP_SOCK},server=on,wait=off",
        "-serial", f"file:{os.path.join(OUT, f'serial-{phase}.log')}",
    ]
    if with_usb:
        cmd += ["-drive", f"file={USB},if=none,id=stick,format=raw",
                "-device", "usb-storage,bus=xhci.0,drive=stick,removable=on,bootindex=1"]
    print("+", " ".join(cmd), flush=True)
    return subprocess.Popen(cmd)


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




def serial_has(phase, text):
    try:
        with open(os.path.join(OUT, f"serial-{phase}.log"), errors="replace") as f:
            return text in f.read()
    except OSError:
        return False


def stop():
    if qemu.poll() is None:
        try:
            qmp.cmd("quit")
        except VMGone:
            pass
        qemu.wait(20)


result = "unknown"
try:
    # ---------------------------------------------------------- phase 1 ----
    qemu = start("live", True)
    qmp = QMP(QMP_SOCK)
    wait_shooting(240, 15, "live")
    shot("setup", keep_duplicates=True)
    # Setup window up: drive Agama from a terminal (same token and config as Setup).
    run_dialog("pkill -f shrimp-setup")
    pause(5)
    run_dialog("kgx")
    pause(10)
    type_text("bash /run/initramfs/live/shrimp-test/agama-install.sh\n")
    pause(20)
    shot("terminal", keep_duplicates=True)
    deadline = t() + 100 * 60
    while t() < deadline and qemu.poll() is None and not serial_has("live", "===AGAMA-DONE"):
        wait_shooting(t() + 60, 60, "install")
    for r in ("finished", "failed"):
        if serial_has("live", "===AGAMA-DONE " + r):
            result = r
    print(f"[{t():6.1f}s] Agama: {result}", flush=True)
    shot("install-end", keep_duplicates=True)
    stop()

    # ---------------------------------------------------------- phase 2 ----
    if result == "finished":
        _last_hash = None
        qemu = start("installed", False)
        qmp = QMP(QMP_SOCK)
        wait_shooting(t() + 360, 10, "firstboot")
        shot("firstboot", keep_duplicates=True)
        stop()
except VMGone:
    print(f"[{t():6.1f}s] QEMU exited", flush=True)
finally:
    try:
        stop()
    except Exception:
        pass
    with open(os.path.join(OUT, "shots.json"), "w") as f:
        json.dump({"agama": result, "shots": shots}, f, indent=1)
    for p in ("tmp.png", "vars.fd", "qmp.sock", "disk.qcow2"):
        try:
            os.remove(os.path.join(OUT, p))
        except OSError:
            pass
    print(f"{len(shots)} screenshots in {OUT}, Agama {result}", flush=True)
