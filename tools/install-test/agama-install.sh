#!/bin/bash
# Runs inside the live session (user shrimp, password shrimp) from the test stick made by
# .github/workflows/test-install.yml. Talks to Agama exactly like Setup does (same token,
# same /api paths, config.json from configFromPlan) and logs everything to the serial port.
HERE=$(cd "$(dirname "$0")" && pwd)
echo shrimp | sudo -S -v 2>/dev/null
exec > >(sudo tee /dev/ttyS0 >/dev/null) 2>&1
set -x
T=$(cat /run/shrimp-setup/token 2>/dev/null)
[ -n "$T" ] || { echo "no Agama token"; ls -l /run/shrimp-setup /run/agama; }
api() { curl -sS -m 60 -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -w '\nHTTP %{http_code}\n' "$@"; }
U=http://127.0.0.1
echo ===AGAMA-START
ls -l "$HERE" /run/initramfs/live /run/initramfs/live/shrimp-transfer 2>&1 | head -40
lsblk -o NAME,SIZE,TYPE,FSTYPE,LABEL,MOUNTPOINTS
for p in /api/status /api/issues /api/config /api/system; do
  echo "=== GET $p"; api "$U$p" | head -c 12000; echo
done
echo "=== config.json"; cat "$HERE/config.json"
echo "=== PUT /api/config"; api -X PUT --data @"$HERE/config.json" "$U/api/config"
for i in $(seq 120); do
  s=$(api "$U/api/status"); echo "$s" | grep -q '"progresses":\[\]' && break; sleep 2
done
echo "=== status after config"; api "$U/api/status"
echo "=== issues after config"; api "$U/api/issues"
echo "=== POST install"; api -X POST --data '{"install":null}' "$U/api/action"
stage=unknown
for i in $(seq 360); do   # up to 90 min
  sleep 15
  s=$(api "$U/api/status")
  echo "[$((i*15))s] $s" | tr -d '\n' | head -c 1500; echo
  case "$s" in *'"stage":"finished"'*) stage=finished; break;; *'"stage":"failed"'*) stage=failed; break;; esac
done
echo "=== issues at end"; api "$U/api/issues"
echo "=== journal"
sudo journalctl -b -u agama -u agama-web-server --no-pager -o short-monotonic | grep -v -iE 'pubkey|TmpPath|keyring|Tkey|zypp.tmp|hardlink|database|Pid [0-9]+ |launched' | tail -n 400
echo "=== post-install / target"
sudo ls -la /mnt /mnt/var/lib/shrimp-setup /mnt/usr/bin/shrimp-setup /mnt/home 2>&1 | head -40
sudo find /var/log/agama* /run/agama -maxdepth 2 -name '*post*' -o -maxdepth 2 -name '*script*' 2>/dev/null | head
for f in $(sudo find /var/log/agama* /run/agama /tmp -maxdepth 3 -path '*scripts*' -type f 2>/dev/null | head -20); do echo "--- $f"; sudo tail -n 60 "$f"; done
echo "===AGAMA-DONE $stage"
