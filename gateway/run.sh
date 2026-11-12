#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"
KEY_FILE="$DIR/../gateway_host_key"
if [ ! -f "$KEY_FILE" ]; then
  echo "[+] Generating gateway host key..."
  ssh-keygen -t rsa -b 2048 -f "$KEY_FILE" -N "" -q 2>/dev/null || true
fi
chmod 600 "$KEY_FILE" 2>/dev/null || true
exec "$DIR/.venv/bin/python3" app/main.py

