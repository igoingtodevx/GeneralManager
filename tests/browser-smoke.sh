#!/usr/bin/env bash
set -euo pipefail

python3 -m http.server 8080 >/tmp/general-manager-http.log 2>&1 &
server_pid=$!
chrome_pid=""
cleanup() {
  kill "$server_pid" 2>/dev/null || true
  if [ -n "$chrome_pid" ]; then kill "$chrome_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT

ready=0
for _ in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:8080/ >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.2
done

if [ "$ready" -ne 1 ]; then
  echo "Local server did not start"
  cat /tmp/general-manager-http.log || true
  exit 1
fi

browser=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then
    browser=$(command -v "$candidate")
    break
  fi
done

if [ -z "$browser" ]; then
  echo "No supported Chromium browser found on runner"
  exit 1
fi

echo "Using browser: $browser"
"$browser" --headless=new --no-sandbox --disable-gpu \
  --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 \
  --user-data-dir=/tmp/general-manager-chrome about:blank \
  >/tmp/general-manager-chrome.log 2>&1 &
chrome_pid=$!

if ! node tests/browser-smoke.mjs; then
  echo "--- Chrome log ---"
  cat /tmp/general-manager-chrome.log || true
  exit 1
fi
