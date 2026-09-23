#!/usr/bin/env bash
set -euo pipefail

free_port() {
  python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()
PY
}

APP_PORT=$(free_port)
CDP_PORT=$(free_port)
PROFILE_DIR=$(mktemp -d /tmp/general-manager-chrome-XXXXXX)

python3 -m http.server "$APP_PORT" --bind 127.0.0.1 >/tmp/general-manager-http.log 2>&1 &
server_pid=$!
chrome_pid=""
cleanup() {
  kill "$server_pid" 2>/dev/null || true
  if [ -n "$chrome_pid" ]; then
    kill "$chrome_pid" 2>/dev/null || true
    wait "$chrome_pid" 2>/dev/null || true
  fi
  wait "$server_pid" 2>/dev/null || true
  rm -rf "$PROFILE_DIR" 2>/dev/null || true
}
trap cleanup EXIT

ready=0
for _ in $(seq 1 50); do
  if curl -fsS "http://127.0.0.1:$APP_PORT/" >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.1
done
if [ "$ready" -ne 1 ]; then
  echo "Local server did not start"; cat /tmp/general-manager-http.log || true; exit 1
fi

browser=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then browser=$(command -v "$candidate"); break; fi
done
if [ -z "$browser" ]; then echo "No supported Chromium browser found"; exit 1; fi

echo "Using browser: $browser | app=$APP_PORT | cdp=$CDP_PORT"
"$browser" --headless=new --no-sandbox --disable-gpu \
  --remote-debugging-port="$CDP_PORT" --remote-debugging-address=127.0.0.1 \
  --user-data-dir="$PROFILE_DIR" about:blank >/tmp/general-manager-chrome.log 2>&1 &
chrome_pid=$!

if ! GM_APP_PORT="$APP_PORT" GM_CDP_PORT="$CDP_PORT" node tests/browser-smoke.mjs; then
  echo "--- Chrome log ---"; cat /tmp/general-manager-chrome.log || true; exit 1
fi
