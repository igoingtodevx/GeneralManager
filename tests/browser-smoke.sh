#!/usr/bin/env bash
set -euo pipefail

python3 -m http.server 8080 >/tmp/general-manager-http.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8080/ >/dev/null; then
    break
  fi
  sleep 0.2
done

html=$(google-chrome --headless=new --no-sandbox --disable-gpu \
  --virtual-time-budget=5000 --dump-dom http://127.0.0.1:8080/ 2>/tmp/general-manager-chrome.log)

echo "$html" | grep -q 'id="quick-input"'
echo "$html" | grep -q 'id="command-overlay"'
echo "$html" | grep -q 'id="auth-overlay"'

echo "Browser smoke passed: shell rendered and Firebase auth reached the signed-out UI."
