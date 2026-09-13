#!/usr/bin/env bash
set -euo pipefail

python3 -m http.server 8080 >/tmp/general-manager-http.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT

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
set +e
html=$($browser --headless=new --no-sandbox --disable-gpu \
  --virtual-time-budget=7000 --dump-dom http://127.0.0.1:8080/ 2>/tmp/general-manager-chrome.log)
status=$?
set -e

if [ "$status" -ne 0 ]; then
  echo "Headless browser failed with exit code $status"
  cat /tmp/general-manager-chrome.log || true
  exit "$status"
fi

printf '%s' "$html" | grep -q 'id="quick-input"'
printf '%s' "$html" | grep -q 'id="command-overlay"'
printf '%s' "$html" | grep -q 'id="auth-overlay"'

echo "Browser smoke passed: shell rendered and Firebase auth reached the signed-out UI."
